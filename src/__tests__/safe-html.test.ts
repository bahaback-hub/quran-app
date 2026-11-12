import { describe, expect, it } from 'vitest';
import { setTrustedHtml } from '../safe-html.js';

describe('setTrustedHtml', () => {
  it('replaces the previous children instead of appending', () => {
    const host = document.createElement('div');
    host.append(document.createElement('span'));

    setTrustedHtml(host, '<p class="one">أولاً</p><p class="two">ثانياً</p>');

    expect(host.children).toHaveLength(2);
    expect(host.querySelector('.one')?.textContent).toBe('أولاً');
    expect(host.querySelector('.two')?.textContent).toBe('ثانياً');
  });

  it('keeps option fragments usable inside a select', () => {
    const select = document.createElement('select');

    setTrustedHtml(select, '<option value="1">الفاتحة</option><option value="2" selected>البقرة</option>');

    expect(select.options).toHaveLength(2);
    expect(select.value).toBe('2');
    expect(select.options[0]?.textContent).toBe('الفاتحة');
  });

  it('keeps table-row fragments usable inside a tbody', () => {
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    table.append(tbody);

    setTrustedHtml(tbody, '<tr><td>الفجر</td><td>04:32</td></tr>');

    expect(tbody.rows).toHaveLength(1);
    expect(tbody.rows[0]?.cells[0]?.textContent).toBe('الفجر');
  });

  it('preserves attributes and aria state', () => {
    const host = document.createElement('div');

    setTrustedHtml(host, '<button type="button" aria-pressed="true" class="on">🔊</button>');

    const button = host.querySelector('button');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(button?.className).toBe('on');
  });

  it('empties the target for an empty string', () => {
    const host = document.createElement('div');
    host.append(document.createElement('span'));

    setTrustedHtml(host, '');

    expect(host.childNodes).toHaveLength(0);
  });
});
