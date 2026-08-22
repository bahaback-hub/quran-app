import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface ContemplationEntry {
  ayah: number;
  sectionTag: string;
  questions: string[];
}

const projectRoot = resolve(import.meta.dirname, '../..');
const dataDirectory = resolve(projectRoot, 'public/data/contemplation');
const reviewedSurahs = [93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
const genericPatterns = [
  'ما المحور الذي تضيفه الآية',
  'كيف يخدم موضع الآية',
  'ما الصلة بين هذا المشهد',
  'ما القضية التي تبرزها الآية',
  'ما المعنى الذي تفتحه الآية',
  'ما الوجه الذي تبرزه الآية',
];

describe('contemplation editorial quality', () => {
  it('keeps the reviewed short surahs free of generic question templates', async () => {
    const entries = (
      await Promise.all(
        reviewedSurahs.map(async (surah) => {
          const file = `surah-${String(surah).padStart(3, '0')}.json`;
          return JSON.parse(await readFile(resolve(dataDirectory, file), 'utf8')) as ContemplationEntry[];
        }),
      )
    ).flat();

    expect(entries).not.toHaveLength(0);
    for (const entry of entries) {
      expect(entry.sectionTag.trim()).not.toBe('');
      expect(entry.questions).toHaveLength(3);
      expect(new Set(entry.questions)).toHaveLength(3);
      for (const question of entry.questions) {
        expect(question).toMatch(/؟$/);
        expect(genericPatterns.some((pattern) => question.includes(pattern))).toBe(false);
      }
    }
  });

  it('uses an al-alaq question tied to reading and divine generosity', async () => {
    const file = resolve(dataDirectory, 'surah-096.json');
    const entries = JSON.parse(await readFile(file, 'utf8')) as ContemplationEntry[];
    const ayahThree = entries.find((entry) => entry.ayah === 3);

    expect(ayahThree?.sectionTag).toBe('كرم الله وتعليم الإنسان');
    expect(ayahThree?.questions).toEqual([
      'لماذا يتكرر الأمر بالقراءة في هذا الموضع من السورة؟',
      'ما الذي يضيفه وصف الرب بأنه الأكرم إلى معنى القراءة؟',
      'كيف تمهد هذه الآية لذكر وسائل التعليم في الآيات التالية؟',
    ]);
  });
});
