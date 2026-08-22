import { beforeEach, describe, expect, it, vi } from 'vitest';

const manifest = {
  schemaVersion: 1,
  surahs: [{ surah: 2, file: 'surah-002.json' }],
};

const questionEntry = {
  id: '2:1',
  surah: 2,
  ayah: 1,
  questions: ['السؤال الأول', 'السؤال الثاني', 'السؤال الثالث'],
};

function mountSheet(): void {
  document.body.innerHTML = `
    <div id="contemplationSheet" class="hidden">
      <p id="contemplationReference"></p>
      <h2 id="contemplationTitle"></h2>
      <button id="contemplationCloseBtn"></button>
      <p id="contemplationHint"></p>
      <ol id="contemplationQuestions"></ol>
    </div>`;
}

function mockLocalData(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) {
        return new Response(JSON.stringify(manifest), { status: 200 });
      }
      if (url.endsWith('surah-002.json')) {
        return new Response(JSON.stringify([questionEntry]), { status: 200 });
      }
      return new Response('', { status: 404 });
    }),
  );
}

describe('contemplation', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    mountSheet();
    mockLocalData();
  });

  it('loads only the manifest and requested surah data for an available ayah', async () => {
    const { hasContemplation } = await import('../contemplation.js');

    await expect(hasContemplation(2, 1)).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith('data/contemplation/manifest.json');
    expect(fetch).toHaveBeenCalledWith('data/contemplation/surah-002.json');
    expect(fetch).not.toHaveBeenCalledWith('data/contemplation-questions.partial.json');
  });

  it('hides the action and explains gradual coverage when the ayah is not prepared', async () => {
    const { initContemplation, syncContemplationAction } = await import('../contemplation.js');
    initContemplation();
    const button = document.createElement('button');
    const status = document.createElement('p');

    await syncContemplationAction(button, status, 2, 2);

    expect(button.hidden).toBe(true);
    expect(status.hidden).toBe(false);
    expect(status.textContent).toBeTruthy();
  });

  it('renders exactly three locally stored questions in the sheet', async () => {
    const { initContemplation, openContemplation } = await import('../contemplation.js');
    initContemplation();

    await openContemplation(1, 1, 'الفاتحة');

    expect(document.querySelectorAll('#contemplationQuestions li')).toHaveLength(3);
    expect(document.getElementById('contemplationSheet')?.classList.contains('hidden')).toBe(false);
  });
});
