#!/usr/bin/env python3
"""Build the local review-only Quran contemplation draft using Gemini once.

The API key must be supplied through GEMINI_API_KEY in the process environment.
It is never written to the output, checkpoint, repository, or command arguments.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from google import genai
from google.genai import types

from build_contemplation_drafts import (
    RESPONSE_SCHEMA,
    SYSTEM_PROMPT,
    build_duplicate_report,
    build_request,
    chunk_surah,
    load_quran,
    validate_chunk,
    write_json,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    parser.add_argument("--checkpoint", required=True, type=Path)
    parser.add_argument("--model", required=True)
    parser.add_argument("--window-size", type=int, default=16)
    parser.add_argument("--lookback", type=int, default=8)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--max-batches", type=int, default=0)
    parser.add_argument("--start-surah", type=int, default=1)
    parser.add_argument("--end-surah", type=int, default=114)
    return parser.parse_args()


def response_schema() -> dict[str, Any]:
    return RESPONSE_SCHEMA["json_schema"]["schema"]


def call_gemini(chunk: dict[str, Any], model: str) -> dict[str, Any]:
    request = build_request(chunk)
    prompt = request["messages"][1]["content"]
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.35,
            response_mime_type="application/json",
            response_json_schema=response_schema(),
        ),
    )
    if not response.text:
        raise RuntimeError("لم يعد Gemini محتوى نصياً منظماً لهذه الدفعة.")
    return json.loads(response.text)


def generate_one(chunk: dict[str, Any], model: str) -> list[dict[str, Any]]:
    last_error: Exception | None = None
    for attempt in range(4):
        try:
            return validate_chunk(chunk, call_gemini(chunk, model))
        except Exception as error:
            last_error = error
            time.sleep(2 ** attempt)
    raise RuntimeError(f"تعذر توليد {chunk['surah']}:{chunk['targets'][0]['numberInSurah']}: {last_error}")


def main() -> int:
    args = parse_args()
    if not os.environ.get("GEMINI_API_KEY"):
        raise RuntimeError("لا يتوفر مفتاح Gemini في بيئة التشغيل.")

    surahs = [
        surah for surah in load_quran(args.source)
        if args.start_surah <= int(surah["number"]) <= args.end_surah
    ]
    chunks = [chunk for surah in surahs for chunk in chunk_surah(surah, args.window_size, args.lookback)]
    total_ayahs = sum(len(surah["ayahs"]) for surah in surahs)
    checkpoint: dict[str, list[dict[str, Any]]] = {}
    if args.checkpoint.exists():
        checkpoint = json.loads(args.checkpoint.read_text(encoding="utf-8"))
    pending = [chunk for chunk in chunks if f"{chunk['surah']}:{chunk['targets'][0]['numberInSurah']}" not in checkpoint]
    if args.max_batches > 0:
        pending = pending[:args.max_batches]
    failures: list[dict[str, str]] = []

    print(f"سيُنشأ {total_ayahs} سجلًا عبر {len(chunks)} دفعة؛ المتبقي {len(pending)}.", flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(generate_one, chunk, args.model): chunk for chunk in pending}
        for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
            chunk = futures[future]
            key = f"{chunk['surah']}:{chunk['targets'][0]['numberInSurah']}"
            try:
                records = future.result()
            except Exception as error:
                failures.append({"chunk": key, "error": str(error)})
                print(f"تعذر {index}/{len(pending)}: {key} — {error}", flush=True)
                continue
            checkpoint[key] = records
            write_json(args.checkpoint, checkpoint)
            print(f"تمت {index}/{len(pending)}: {key}", flush=True)

    if failures:
        write_json(args.checkpoint.with_name("gemini-failures.json"), failures)
        return 2

    if args.max_batches > 0:
        print(f"اكتملت الدفعات المحددة؛ أصبح في نقطة الحفظ {sum(len(items) for items in checkpoint.values())} سجلًا.", flush=True)
        return 0

    entries = [entry for records in checkpoint.values() for entry in records]
    entries.sort(key=lambda item: (item["surah"], item["ayah"]))
    expected_ids = [
        f"{surah['number']}:{ayah['numberInSurah']}"
        for surah in surahs for ayah in surah["ayahs"]
    ]
    if [entry["id"] for entry in entries] != expected_ids:
        raise RuntimeError("تغطية الآيات غير مكتملة أو غير مرتبة؛ لن يُكتب الملف النهائي.")

    duplicate_findings = build_duplicate_report(entries)
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
        "generationProvider": "Gemini (one-time content preparation)",
        "entryCount": len(entries),
        "entries": entries,
    }
    report = {
        "expectedEntryCount": total_ayahs,
        "actualEntryCount": len(entries),
        "validCoverage": len(entries) == total_ayahs,
        "repeatedTextGroupsWithQuestionDuplicates": duplicate_findings,
        "entriesNeedingRevision": sum(entry["reviewStatus"] == "needs_revision" for entry in entries),
    }
    write_json(args.out, document)
    write_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
