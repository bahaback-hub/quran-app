#!/usr/bin/env python3
"""Generate resumable, review-only Quran contemplation-question drafts.

The generated data contains ayah references and editorial questions only. It does
not copy Quran text into the output, and every entry starts as `draft`.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ARABIC_DIACRITICS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]")
QUESTION_ENDING = "؟"
PERSONAL_PATTERNS = (
    "يومك",
    "حياتك",
    "نفسك",
    "اصدقائك",
    "أصدقائك",
    "عملك",
    "مشاعرك",
    "قرارك الشخصي",
    "نفسيته",
    "نفسية",
    "القارئ",
    "الإنسان",
    "مناحي حياته",
)
GENERIC_PATTERNS = (
    "ما المعنى أو الغاية",
    "ما الهدف الروحي أو البلاغي",
    "ما المقصود أو الغاية",
    "ما الهدف الذي يفتحه",
    "ما حكمة صياغة",
    "كيف يمهد هذا",
)

SYSTEM_PROMPT = """أنت محرر عربي لأسئلة تدبر القرآن، ولا تكتب تفسيراً ولا فتوى.
أنتج ثلاثة أسئلة فقط لكل آية مستهدفة. لكل آية: اجعل السؤال الأول عن المعنى أو الغاية
التي تفتحها الآية، والثاني عن حكمة اختيار التعبير أو موقعها في ترتيب السورة، والثالث
عن صلتها بالآيات القريبة. يجب أن تكون الأسئلة مفتوحة وقصيرة وواضحة للقارئ العام.
لا تعط إجابة أو شرحاً تقريرياً، ولا تنسب قولاً لعالِم، ولا تطلب بيانات أو تجارب شخصية
من القارئ. لا تكتب أسئلة من نوع: ماذا ستفعل اليوم، كيف تشعر، ما مشكلتك، أو من
أصدقاؤك. لا تجعل السؤال درساً في الإعراب أو الضمائر أو المصطلحات اللغوية الدقيقة إلا
إذا كان ذلك محور المعنى الواضح في الآية. لا تنسخ ألفاظاً من الآية بين علامتي اقتباس؛
صغ السؤال بكلماتك من غير تغيير أو تفسير للنص. إذا تكرر النص في مواضع متعددة، اربط
السؤال بما سبق في السياق الحالي واجعل الأسئلة مختلفة عن الزوايا العامة للنص المكرر.
لا تكتب قوالب عامة من قبيل: ما المعنى أو الغاية، أو ما الهدف الروحي، أو ما المقصود
أو الغاية. اجعل كل سؤال محدداً بالآية. مثال مستوى الصياغة المطلوب لآية الحمد في
الفاتحة: لماذا تأتي آية الحمد في افتتاح السورة؟ ما الذي يضيف وصف رب العالمين إلى
معنى الحمد؟ كيف يهيئ الحمد للانتقال إلى صفات الرحمة في الآيات التالية؟
لا تجعل السؤال عن أثر الآية في نفس القارئ أو حياته أو توجهه الشخصي، ولا تذكر الإنسان
أو القارئ أو النفس. المطلوب سؤال في المعنى والغاية والترتيب والسياق القرآني نفسه.
أخرج JSON فقط وفق المخطط المطلوب."""

RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "json_schema",
    "json_schema": {
        "name": "contemplation_question_batch",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "ayah": {"type": "integer"},
                            "sectionTag": {"type": "string"},
                            "questions": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 3,
                                "maxItems": 3,
                            },
                        },
                        "required": ["ayah", "sectionTag", "questions"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--model", default="gpt-5-mini")
    parser.add_argument("--window-size", type=int, default=8)
    parser.add_argument("--lookback", type=int, default=8)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--start-surah", type=int, default=1)
    parser.add_argument("--end-surah", type=int, default=114)
    return parser.parse_args()


def load_quran(source: Path) -> list[dict[str, Any]]:
    payload = json.loads(source.read_text(encoding="utf-8"))
    surahs = payload.get("data", {}).get("surahs")
    if not isinstance(surahs, list) or len(surahs) != 114:
        raise ValueError("لم يحتوي المصدر على 114 سورة كما هو متوقع.")
    return surahs


def normalize(value: str) -> str:
    value = ARABIC_DIACRITICS.sub("", value)
    value = re.sub(r"[^\w\u0600-\u06FF]+", "", value)
    return value.lower()


def ayah_text(ayah: dict[str, Any]) -> str:
    text = ayah.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("وجدت آية بلا نص في المصدر.")
    return text.strip()


def chunk_surah(surah: dict[str, Any], window_size: int, lookback: int) -> list[dict[str, Any]]:
    ayahs = surah["ayahs"]
    chunks: list[dict[str, Any]] = []
    for offset in range(0, len(ayahs), window_size):
        targets = ayahs[offset : offset + window_size]
        context = ayahs[max(0, offset - lookback) : offset]
        chunks.append({
            "surah": surah["number"],
            "surahName": surah.get("name", ""),
            "context": context,
            "targets": targets,
        })
    return chunks


def build_request(chunk: dict[str, Any]) -> dict[str, Any]:
    def pack(ayah: dict[str, Any]) -> dict[str, Any]:
        return {"ayah": ayah["numberInSurah"], "text": ayah_text(ayah)}

    content = {
        "surah": chunk["surah"],
        "surahName": chunk["surahName"],
        "contextBefore": [pack(ayah) for ayah in chunk["context"]],
        "targetAyahs": [pack(ayah) for ayah in chunk["targets"]],
        "instruction": "أنتج بنداً واحداً فقط لكل رقم في targetAyahs، وبالترتيب نفسه.",
    }
    return {
        "model": os.environ.get("CONTEMPLATION_MODEL", "gpt-5-mini"),
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(content, ensure_ascii=False)},
        ],
        "response_format": RESPONSE_SCHEMA,
        "max_completion_tokens": 8000,
        "reasoning": {"effort": "minimal"},
    }


def post_json(payload: dict[str, Any]) -> dict[str, Any]:
    base = os.environ.get("OPENAI_API_BASE")
    key = os.environ.get("OPENAI_API_KEY")
    if not base or not key:
        raise RuntimeError("لا تتوفر بيانات اتصال نموذج اللغة في البيئة.")
    request = Request(
        f"{base.rstrip('/')}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urlopen(request, timeout=60) as response:
        body = json.loads(response.read().decode("utf-8"))
    if not isinstance(body, dict) or not body.get("choices"):
        raise RuntimeError(f"استجابة نموذج غير مكتملة: {json.dumps(body, ensure_ascii=False)[:800]}")
    content = body["choices"][0]["message"]["content"]
    return json.loads(content)


def clean_question(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("السؤال ليس نصاً.")
    question = re.sub(r"\s+", " ", value.strip())
    if not question.endswith(("؟", "?")):
        question += QUESTION_ENDING
    if len(question) < 12 or len(question) > 180:
        raise ValueError(f"طول سؤال غير صالح: {question}")
    if any(pattern in question for pattern in PERSONAL_PATTERNS):
        raise ValueError(f"وجد سؤال شخصي مستبعد: {question}")
    if any(pattern in question for pattern in GENERIC_PATTERNS):
        raise ValueError(f"وجد قالب عام غير مقبول: {question}")
    return question


def validate_chunk(chunk: dict[str, Any], output: dict[str, Any]) -> list[dict[str, Any]]:
    items = output.get("items")
    targets = chunk["targets"]
    if not isinstance(items, list) or len(items) != len(targets):
        raise ValueError("عدد بنود الإجابة لا يساوي عدد الآيات المستهدفة.")

    records: list[dict[str, Any]] = []
    for expected, item in zip(targets, items, strict=True):
        expected_ayah = expected["numberInSurah"]
        if not isinstance(item, dict) or item.get("ayah") != expected_ayah:
            raise ValueError(f"ترقيم آية غير متطابق في {chunk['surah']}:{expected_ayah}.")
        questions = [clean_question(question) for question in item.get("questions", [])]
        if len(questions) != 3 or len({normalize(question) for question in questions}) != 3:
            raise ValueError(f"الأسئلة الثلاثة غير مكتملة أو متكررة في {chunk['surah']}:{expected_ayah}.")
        section_tag = re.sub(r"\s+", " ", str(item.get("sectionTag", "")).strip())
        if not section_tag or len(section_tag) > 80:
            raise ValueError(f"وسم سياق غير صالح في {chunk['surah']}:{expected_ayah}.")
        text_hash = hashlib.sha256(normalize(ayah_text(expected)).encode("utf-8")).hexdigest()[:16]
        records.append({
            "id": f"{chunk['surah']}:{expected_ayah}",
            "surah": chunk["surah"],
            "ayah": expected_ayah,
            "repeatGroup": f"text:{text_hash}",
            "sectionTag": section_tag,
            "questions": questions,
            "reviewStatus": "draft",
        })
    return records


def generate_one(chunk: dict[str, Any]) -> list[dict[str, Any]]:
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            return validate_chunk(chunk, post_json(build_request(chunk)))
        except (HTTPError, URLError, TimeoutError, KeyError, ValueError, json.JSONDecodeError) as error:
            last_error = error
            time.sleep(2 ** attempt)
    raise RuntimeError(f"تعذر توليد {chunk['surah']}:{chunk['targets'][0]['numberInSurah']}: {last_error}")


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def build_duplicate_report(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_group: dict[str, list[dict[str, Any]]] = {}
    for entry in entries:
        by_group.setdefault(entry["repeatGroup"], []).append(entry)

    findings: list[dict[str, Any]] = []
    for group, group_entries in by_group.items():
        if len(group_entries) < 2:
            continue
        question_index: dict[str, list[str]] = {}
        for entry in group_entries:
            for question in entry["questions"]:
                question_index.setdefault(normalize(question), []).append(entry["id"])
        duplicates = [
            {"question": normalized, "entryIds": ids}
            for normalized, ids in question_index.items()
            if len(ids) > 1
        ]
        if duplicates:
            for entry in group_entries:
                entry["reviewStatus"] = "needs_revision"
            findings.append({"repeatGroup": group, "entries": [e["id"] for e in group_entries], "duplicates": duplicates})
    return findings


def main() -> int:
    args = parse_args()
    os.environ["CONTEMPLATION_MODEL"] = args.model
    surahs = [
        surah for surah in load_quran(args.source)
        if args.start_surah <= int(surah["number"]) <= args.end_surah
    ]
    all_chunks = [
        chunk for surah in surahs
        for chunk in chunk_surah(surah, args.window_size, args.lookback)
    ]
    total_ayahs = sum(len(surah["ayahs"]) for surah in surahs)

    checkpoint: dict[str, list[dict[str, Any]]] = {}
    if args.checkpoint.exists():
        checkpoint = json.loads(args.checkpoint.read_text(encoding="utf-8"))
    pending = [chunk for chunk in all_chunks if f"{chunk['surah']}:{chunk['targets'][0]['numberInSurah']}" not in checkpoint]

    print(f"سيُنشأ {total_ayahs} سجلًا عبر {len(all_chunks)} دفعة؛ المتبقي {len(pending)}.", flush=True)
    failures: list[dict[str, str]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(generate_one, chunk): chunk for chunk in pending}
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            chunk = futures[future]
            key = f"{chunk['surah']}:{chunk['targets'][0]['numberInSurah']}"
            try:
                records = future.result()
            except Exception as error:  # Keep completed batches resumable after one bad request.
                failures.append({"chunk": key, "error": str(error)})
                print(f"تعذر {index}/{len(pending)}: {key} — {error}", flush=True)
                continue
            checkpoint[key] = records
            write_json(args.checkpoint, checkpoint)
            print(f"تمت {index}/{len(pending)}: {key}", flush=True)

    if failures:
        failure_path = args.checkpoint.with_name("failures.json")
        write_json(failure_path, failures)
        print(f"تحتاج {len(failures)} دفعة إلى إعادة محاولة: {failure_path}", flush=True)
        return 2

    entries = [entry for records in checkpoint.values() for entry in records]
    entries.sort(key=lambda item: (item["surah"], item["ayah"]))
    expected_ids = [
        f"{surah['number']}:{ayah['numberInSurah']}"
        for surah in surahs for ayah in surah["ayahs"]
    ]
    actual_ids = [entry["id"] for entry in entries]
    if actual_ids != expected_ids:
        raise RuntimeError("تغطية الآيات غير مكتملة أو غير مرتبة؛ لن يكتب الملف النهائي.")

    duplicates = build_duplicate_report(entries)
    document = {
        "schemaVersion": 1,
        "kind": "quran-contemplation-question-drafts",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "provider": "AlQuran.Cloud",
            "edition": "quran-uthmani",
            "endpoint": "https://api.alquran.cloud/v1/quran/quran-uthmani",
            "textIncluded": False,
        },
        "editorialStatus": "drafts_require_human_review",
        "entryCount": len(entries),
        "entries": entries,
    }
    report = {
        "expectedEntryCount": total_ayahs,
        "actualEntryCount": len(entries),
        "validCoverage": len(entries) == total_ayahs,
        "repeatedTextGroupsWithQuestionDuplicates": duplicates,
        "entriesNeedingRevision": sum(1 for entry in entries if entry["reviewStatus"] == "needs_revision"),
    }
    write_json(args.out, document)
    write_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
