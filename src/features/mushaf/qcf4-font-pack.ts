/**
 * QCF4 font assets used by the Madinah Mushaf page renderer.
 * The files are shipped from this application's own origin and are cached
 * together with the user-installed Mushaf package for offline use.
 */

export const QCF4_FONT_NAMES = [
  ...Array.from({ length: 47 }, (_, index) => `QCF4_Hafs_${String(index + 1).padStart(2, '0')}`),
  'QCF4_QBSML',
] as const;

export const QCF4_FONT_TOTAL_BYTES = 37_383_488;
export const QCF4_FONT_CACHE_NAME = 'mushaf-fonts';

export function qcf4FontUrl(fontName: string): string {
  const fileName = fontName === 'QCF4_QBSML' ? 'QCF4_QBSML.woff2' : `${fontName}_W.woff2`;
  return `${import.meta.env.BASE_URL}fonts/qcf4/${fileName}`;
}
