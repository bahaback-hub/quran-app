import { dom } from './dom.js';
import { storage } from './storage.js';

const STEPS = [
  {
    icon: '📖',
    title: 'القرآن الكريم',
    desc: 'تلاوة، تفسير، بحث، ومواقيت الصلاة — كل ما تحتاجه في تطبيق واحد.'
  },
  {
    icon: '🎧',
    title: 'استمع للقرآن',
    desc: 'اختر قارئك المفضل من 8 قرّاء، وتحكم في سرعة التلاوة ومؤقت النوم.'
  },
  {
    icon: '🔎',
    title: 'بحث ذكي',
    desc: 'ابحث في القرآن كاملًا بنتائج مرتبة حسب الأهمية مع إكمال تلقائي.'
  },
  {
    icon: '📜',
    title: 'التفسير والترجمة',
    desc: '6 تفاسير معتمدة وترجمة المعاني بلغات متعددة.'
  },
  {
    icon: '🕌',
    title: 'مواقيت الصلاة',
    desc: 'مواقيت دقيقة مع الأذان والتنبيهات.'
  },
  {
    icon: '⚙️',
    title: 'تخصيص كامل',
    desc: 'الوضع الليلي، وضع السيبيا، تغيير الخط والمسافات، تصدير المفضلة.'
  }
];

export function hasSeenOnboarding() {
  return storage.get('onboarding_seen');
}

export function startOnboarding() {
  if (hasSeenOnboarding()) return;
  storage.set('onboarding_seen', true);
  showOnboarding();
}

function showOnboarding() {
  const overlay = document.createElement('div');
  overlay.id = 'onboardingOverlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center;
    direction: rtl;
    font-family: 'Amiri', 'Traditional Arabic', serif;
  `;
  const inner = document.createElement('div');
  inner.style.cssText = `
    background: var(--container-bg, #fefdf8);
    border-radius: 24px;
    padding: 40px 32px 32px;
    max-width: 420px;
    width: 90vw;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    position: relative;
  `;

  const dotContainer = document.createElement('div');
  dotContainer.style.cssText = `
    display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;
  `;
  const dots = [];
  for (let i = 0; i < STEPS.length; i++) {
    const dot = document.createElement('span');
    dot.style.cssText = `
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--border, #d4c9a8);
      transition: all 0.3s ease; display: inline-block;
    `;
    if (i === 0) dot.style.background = 'var(--accent, #d4af37)';
    dotContainer.appendChild(dot);
    dots.push(dot);
  }

  const iconEl = document.createElement('div');
  iconEl.style.cssText = 'font-size: 56px; margin-bottom: 16px;';
  iconEl.textContent = STEPS[0].icon;

  const titleEl = document.createElement('h2');
  titleEl.style.cssText = `
    font-size: 24px; color: var(--text-primary, #1a1a1a);
    margin-bottom: 12px; font-weight: bold;
  `;
  titleEl.textContent = STEPS[0].title;

  const descEl = document.createElement('p');
  descEl.style.cssText = `
    font-size: 16px; line-height: 1.7;
    color: var(--text-secondary, #2c3e50);
    margin-bottom: 28px;
  `;
  descEl.textContent = STEPS[0].desc;

  const navRow = document.createElement('div');
  navRow.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '→ السابق';
  prevBtn.style.cssText = `
    padding: 10px 20px; border-radius: 12px; border: 2px solid var(--accent, #d4af37);
    background: transparent; color: var(--text-primary, #1a1a1a);
    font-size: 15px; cursor: pointer; font-family: inherit;
    display: none;
  `;

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'التالي ←';
  nextBtn.style.cssText = `
    padding: 10px 24px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #8b6f5a, #a0846c);
    color: #fff; font-size: 15px; cursor: pointer; font-family: inherit;
  `;

  const skipBtn = document.createElement('button');
  skipBtn.textContent = 'تخطي';
  skipBtn.style.cssText = `
    padding: 10px 20px; border-radius: 12px; border: none;
    background: transparent; color: var(--text-muted, #5a5a5a);
    font-size: 14px; cursor: pointer; font-family: inherit;
    position: absolute; top: 12px; left: 16px;
  `;

  let stepIdx = 0;

  function updateStep() {
    const s = STEPS[stepIdx];
    iconEl.textContent = s.icon;
    titleEl.textContent = s.title;
    descEl.textContent = s.desc;
    dots.forEach((d, i) => {
      d.style.background = i <= stepIdx ? 'var(--accent, #d4af37)' : 'var(--border, #d4c9a8)';
      d.style.width = i === stepIdx ? '20px' : '8px';
      d.style.borderRadius = i === stepIdx ? '4px' : '50%';
    });
    prevBtn.style.display = stepIdx === 0 ? 'none' : '';
    nextBtn.textContent = stepIdx === STEPS.length - 1 ? '✔️ ابدأ التطبيق' : 'التالي ←';
  }

  prevBtn.addEventListener('click', () => {
    if (stepIdx > 0) { stepIdx--; updateStep(); }
  });

  nextBtn.addEventListener('click', () => {
    if (stepIdx < STEPS.length - 1) { stepIdx++; updateStep(); }
    else { overlay.remove(); }
  });

  skipBtn.addEventListener('click', () => { overlay.remove(); });

  navRow.appendChild(prevBtn);
  navRow.appendChild(nextBtn);
  inner.appendChild(skipBtn);
  inner.appendChild(dotContainer);
  inner.appendChild(iconEl);
  inner.appendChild(titleEl);
  inner.appendChild(descEl);
  inner.appendChild(navRow);
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
}
