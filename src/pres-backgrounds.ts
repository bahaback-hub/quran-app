import { __ } from './i18n.js';

/** WeakMap for storing cleanup functions on canvas elements (replaces expando properties). */
const _cleanupMap = new WeakMap<Element, () => void>();

/** Available nature background images with their mood/time. */
export const NATURE_BACKGROUNDS = [
  { src: 'backgrounds/dawn.jpg', mood: 'dawn', label: __('bg_dawn') },
  { src: 'backgrounds/clouds.jpg', mood: 'morning', label: __('bg_morning') },
  { src: 'backgrounds/mountains.jpg', mood: 'afternoon', label: __('bg_afternoon') },
  { src: 'backgrounds/sunset.jpg', mood: 'sunset', label: __('bg_sunset') },
  { src: 'backgrounds/nightsky.jpg', mood: 'night', label: __('bg_night') },
];

/** Get a background image based on the current time of day. */
export function getAutoBackground(): (typeof NATURE_BACKGROUNDS)[number] {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 7) {
    return NATURE_BACKGROUNDS[0]!;
  } // dawn
  if (hour >= 7 && hour < 12) {
    return NATURE_BACKGROUNDS[1]!;
  } // morning clouds
  if (hour >= 12 && hour < 16) {
    return NATURE_BACKGROUNDS[2]!;
  } // afternoon mountains
  if (hour >= 16 && hour < 19) {
    return NATURE_BACKGROUNDS[3]!;
  } // sunset
  return NATURE_BACKGROUNDS[4]!; // night sky
}

/** Get a specific nature background by its mood key. */
export function getNatureBgByMood(mood: string): (typeof NATURE_BACKGROUNDS)[number] | null {
  return NATURE_BACKGROUNDS.find((bg) => bg.mood === mood) || null;
}

/** Get a random nature background (cycles per ayah). */
export function getRandomNatureBg(): (typeof NATURE_BACKGROUNDS)[number] {
  const idx = Math.floor(Math.random() * NATURE_BACKGROUNDS.length);
  return NATURE_BACKGROUNDS[idx]!;
}

/** Animation frame ID for canvas scene rendering. */
let _sceneAnimationId: number | null = null;
/** Cleanup function returned by the active scene renderer. Stored so we can
 *  properly clean up nested animation loops (e.g., shooting stars inside stars scene). */
let _sceneCleanup: (() => void) | null = null;

/** Ken Burns animation variants — each uses a different pan/zoom direction. */
const KEN_BURNS_ANIMATIONS = [
  'kenBurns1', // zoom in + pan right
  'kenBurns2', // zoom out + pan left
  'kenBurns3', // zoom in + pan up
  'kenBurns4', // zoom out + pan down
  'kenBurns5', // slow zoom in center
];

/** Pick a random Ken Burns animation name. */
export function getRandomKenBurns(): string {
  return KEN_BURNS_ANIMATIONS[Math.floor(Math.random() * KEN_BURNS_ANIMATIONS.length)]!;
}

/** Remove any animated background layer from the overlay. */
export function removeAnimatedBgLayer(overlay: HTMLElement): void {
  const existing = overlay.querySelector('.pres-bg-layer');
  if (existing) {
    existing.remove();
  }
}

/** Create and insert the animated background image layer with a random Ken Burns effect. */
export function applyAnimatedBg(overlay: HTMLElement, bgSrc: string): void {
  removeAnimatedBgLayer(overlay);
  const layer = document.createElement('div');
  layer.className = 'pres-bg-layer ' + getRandomKenBurns();
  layer.style.backgroundImage = `url('${bgSrc}')`;
  overlay.insertBefore(layer, overlay.firstChild);
}

/* ===== CANVAS ANIMATED SCENES ===== */

/** Remove the scene canvas and stop its animation loop. */
export function removeSceneCanvas(overlay: HTMLElement): void {
  // Call the scene's own cleanup function first (handles nested animation loops)
  if (_sceneCleanup) {
    try {
      _sceneCleanup();
    } catch {
      /* ignore */
    }
    _sceneCleanup = null;
  }
  if (_sceneAnimationId !== null) {
    cancelAnimationFrame(_sceneAnimationId);
    _sceneAnimationId = null;
  }
  const existing = overlay.querySelector('.pres-canvas-bg');
  if (existing) {
    // Clean up resize listener
    const cleanup = _cleanupMap.get(existing);
    if (typeof cleanup === 'function') {
      window.removeEventListener('resize', cleanup);
      _cleanupMap.delete(existing);
    }
    existing.remove();
  }
}

/** Star data for the stars scene. */
interface StarData {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
  phase: number;
}

/** Shooting star data. */
interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  length: number;
}

/** Wave layer data for the waves scene. */
interface WaveLayer {
  amplitude: number;
  frequency: number;
  speed: number;
  yBase: number;
  color: string;
}

/** Particle data for the particles scene. */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
}

/** Rain drop data. */
interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
  opacity: number;
}

/** Star scene — twinkling stars with occasional shooting stars. */
function renderStarsScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let stars: StarData[] = [];
  const shootingStars: ShootingStar[] = [];
  let time = 0;

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    stars = [];
    for (let i = 0; i < 250; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 2.5 + 0.5,
        speed: Math.random() * 0.02 + 0.005,
        brightness: Math.random(),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05050f');
    grad.addColorStop(0.5, '#0a0a2e');
    grad.addColorStop(1, '#101030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Milky way band
    const mwGrad = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.6);
    mwGrad.addColorStop(0, 'rgba(60, 50, 80, 0)');
    mwGrad.addColorStop(0.3, 'rgba(80, 60, 120, 0.06)');
    mwGrad.addColorStop(0.5, 'rgba(100, 80, 140, 0.08)');
    mwGrad.addColorStop(0.7, 'rgba(80, 60, 120, 0.06)');
    mwGrad.addColorStop(1, 'rgba(60, 50, 80, 0)');
    ctx.fillStyle = mwGrad;
    ctx.fillRect(0, 0, w, h);

    // Draw twinkling stars
    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(time * star.speed * 60 + star.phase);
      const alpha = star.brightness * twinkle;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size * (0.7 + 0.3 * twinkle), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${alpha})`;
      ctx.fill();
      // Glow for bigger stars
      if (star.size > 1.8) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 255, ${alpha * 0.1})`;
        ctx.fill();
      }
    }

    // Shooting stars
    if (Math.random() < 0.003) {
      shootingStars.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.3,
        vx: 4 + Math.random() * 4,
        vy: 2 + Math.random() * 2,
        life: 0,
        maxLife: 30 + Math.random() * 30,
        length: 40 + Math.random() * 60,
      });
    }
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const ss = shootingStars[i]!;
      ss.x += ss.vx;
      ss.y += ss.vy;
      ss.life++;
      const alpha = 1 - ss.life / ss.maxLife;
      if (alpha <= 0) {
        shootingStars.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x - (ss.vx * ss.length) / 6, ss.y - (ss.vy * ss.length) / 6);
      const ssGrad = ctx.createLinearGradient(
        ss.x,
        ss.y,
        ss.x - (ss.vx * ss.length) / 6,
        ss.y - (ss.vy * ss.length) / 6,
      );
      ssGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      ssGrad.addColorStop(1, `rgba(255, 255, 255, 0)`);
      ctx.strokeStyle = ssGrad;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => {
    if (_sceneAnimationId !== null) {
      cancelAnimationFrame(_sceneAnimationId);
      _sceneAnimationId = null;
    }
  };
}

/** Ocean waves scene — animated waves with gradient sky. */
function renderWavesScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;

  const waveLayers: WaveLayer[] = [
    { amplitude: 25, frequency: 0.008, speed: 0.4, yBase: 0.45, color: 'rgba(10, 60, 120, 0.4)' },
    { amplitude: 20, frequency: 0.012, speed: 0.6, yBase: 0.52, color: 'rgba(15, 80, 160, 0.5)' },
    { amplitude: 18, frequency: 0.015, speed: 0.8, yBase: 0.58, color: 'rgba(20, 100, 180, 0.6)' },
    { amplitude: 15, frequency: 0.02, speed: 1.0, yBase: 0.64, color: 'rgba(25, 120, 200, 0.7)' },
    { amplitude: 12, frequency: 0.025, speed: 1.3, yBase: 0.7, color: 'rgba(30, 140, 210, 0.8)' },
    { amplitude: 8, frequency: 0.03, speed: 1.6, yBase: 0.78, color: 'rgba(35, 150, 220, 0.85)' },
    { amplitude: 5, frequency: 0.04, speed: 2.0, yBase: 0.85, color: 'rgba(40, 160, 230, 0.9)' },
  ];

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Sky gradient (sunset-like)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
    skyGrad.addColorStop(0, '#0d1b2a');
    skyGrad.addColorStop(0.3, '#1b2838');
    skyGrad.addColorStop(0.6, '#2d4059');
    skyGrad.addColorStop(0.85, '#4a6741');
    skyGrad.addColorStop(1, '#7a8450');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Moon glow
    const moonX = w * 0.75;
    const moonY = h * 0.15;
    const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 120);
    moonGlow.addColorStop(0, 'rgba(255, 255, 200, 0.3)');
    moonGlow.addColorStop(0.3, 'rgba(255, 255, 200, 0.08)');
    moonGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = moonGlow;
    ctx.fillRect(0, 0, w, h);

    // Moon
    ctx.beginPath();
    ctx.arc(moonX, moonY, 20, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
    ctx.fill();

    // Draw waves back to front
    for (const wave of waveLayers) {
      ctx.beginPath();
      const baseY = h * wave.yBase;
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const y =
          baseY +
          Math.sin(x * wave.frequency + time * wave.speed) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.5 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = wave.color;
      ctx.fill();
    }

    // Foam/sparkles on top wave
    for (let i = 0; i < 30; i++) {
      const fx = (i / 30) * w + Math.sin(time * 0.5 + i) * 20;
      const fy = h * 0.44 + Math.sin(fx * 0.008 + time * 0.4) * 25 - 5;
      const sparkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 2 + i * 0.5));
      ctx.beginPath();
      ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${sparkle * 0.5})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => {
    if (_sceneAnimationId !== null) {
      cancelAnimationFrame(_sceneAnimationId);
      _sceneAnimationId = null;
    }
  };
}

/** Aurora scene — northern lights effect. */
function renderAuroraScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#020810');
    skyGrad.addColorStop(0.4, '#050d1a');
    skyGrad.addColorStop(0.7, '#081020');
    skyGrad.addColorStop(1, '#0c1525');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 80; i++) {
      const sx = (Math.sin(i * 127.1 + 311.7) * 0.5 + 0.5) * w;
      const sy = (Math.sin(i * 269.5 + 183.3) * 0.5 + 0.5) * h * 0.6;
      const twinkle = 0.3 + 0.7 * Math.abs(Math.sin(time * 0.5 + i));
      ctx.beginPath();
      ctx.arc(sx, sy, 1, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 240, ${twinkle * 0.6})`;
      ctx.fill();
    }

    // Aurora bands — multiple semi-transparent curved shapes
    const auroraColors = [
      { r: 50, g: 255, b: 100 }, // green
      { r: 80, g: 200, b: 255 }, // blue
      { r: 150, g: 100, b: 255 }, // purple
      { r: 50, g: 255, b: 180 }, // teal
    ];

    for (let band = 0; band < 4; band++) {
      const color = auroraColors[band]!;
      const yCenter = h * (0.15 + band * 0.1);
      const bandWidth = h * 0.15;

      ctx.beginPath();
      ctx.moveTo(0, yCenter);

      for (let x = 0; x <= w; x += 5) {
        const wave1 = Math.sin(x * 0.003 + time * 0.3 + band * 1.5) * 40;
        const wave2 = Math.sin(x * 0.006 + time * 0.5 + band * 0.8) * 25;
        const wave3 = Math.sin(x * 0.001 + time * 0.15 + band * 2.0) * 60;
        const y = yCenter + wave1 + wave2 + wave3;
        ctx.lineTo(x, y);
      }

      for (let x = w; x >= 0; x -= 5) {
        const wave1 = Math.sin(x * 0.003 + time * 0.3 + band * 1.5) * 40;
        const wave2 = Math.sin(x * 0.006 + time * 0.5 + band * 0.8) * 25;
        const wave3 = Math.sin(x * 0.001 + time * 0.15 + band * 2.0) * 60;
        const y = yCenter + wave1 + wave2 + wave3 + bandWidth;
        ctx.lineTo(x, y);
      }

      ctx.closePath();

      const aGrad = ctx.createLinearGradient(0, yCenter - bandWidth, 0, yCenter + bandWidth * 2);
      aGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      aGrad.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
      aGrad.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, 0.12)`);
      aGrad.addColorStop(0.7, `rgba(${color.r}, ${color.g}, ${color.b}, 0.08)`);
      aGrad.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);
      ctx.fillStyle = aGrad;
      ctx.fill();
    }

    // Vertical aurora rays
    for (let i = 0; i < 20; i++) {
      const rx = (i / 20) * w + Math.sin(time * 0.3 + i * 2) * 50;
      const rayHeight = 100 + Math.sin(time * 0.5 + i) * 50;
      const rayAlpha = 0.03 + 0.04 * Math.abs(Math.sin(time * 0.8 + i * 0.7));
      const colorIdx = i % auroraColors.length;
      const c = auroraColors[colorIdx]!;

      const rayGrad = ctx.createLinearGradient(rx, h * 0.1, rx, h * 0.1 + rayHeight);
      rayGrad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      rayGrad.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${rayAlpha})`);
      rayGrad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);

      ctx.beginPath();
      ctx.moveTo(rx - 15, h * 0.1);
      ctx.lineTo(rx + 15, h * 0.1);
      ctx.lineTo(rx + 5, h * 0.1 + rayHeight);
      ctx.lineTo(rx - 5, h * 0.1 + rayHeight);
      ctx.closePath();
      ctx.fillStyle = rayGrad;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => {
    if (_sceneAnimationId !== null) {
      cancelAnimationFrame(_sceneAnimationId);
      _sceneAnimationId = null;
    }
  };
}

/** Golden particles scene — floating dust motes. */
function renderParticlesScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;
  let particles: Particle[] = [];

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    particles = [];
    for (let i = 0; i < 120; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -Math.random() * 0.5 - 0.1,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Dark warm background
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.7);
    bgGrad.addColorStop(0, '#1a1510');
    bgGrad.addColorStop(0.5, '#0f0d08');
    bgGrad.addColorStop(1, '#080604');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Warm light source glow
    const lightGlow = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.4);
    lightGlow.addColorStop(0, 'rgba(255, 200, 100, 0.08)');
    lightGlow.addColorStop(0.5, 'rgba(255, 180, 80, 0.03)');
    lightGlow.addColorStop(1, 'rgba(255, 150, 50, 0)');
    ctx.fillStyle = lightGlow;
    ctx.fillRect(0, 0, w, h);

    // Draw and update particles
    for (const p of particles) {
      p.x += p.vx + Math.sin(time + p.phase) * 0.2;
      p.y += p.vy;

      // Wrap around
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) {
        p.x = w + 10;
      }
      if (p.x > w + 10) {
        p.x = -10;
      }

      const pulse = 0.6 + 0.4 * Math.sin(time * 1.5 + p.phase);
      const alpha = p.opacity * pulse;

      // Glow
      const glowGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      glowGrad.addColorStop(0, `rgba(255, 210, 100, ${alpha * 0.5})`);
      glowGrad.addColorStop(1, 'rgba(255, 180, 50, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(p.x - p.size * 4, p.y - p.size * 4, p.size * 8, p.size * 8);

      // Core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 120, ${alpha})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => {
    if (_sceneAnimationId !== null) {
      cancelAnimationFrame(_sceneAnimationId);
      _sceneAnimationId = null;
    }
  };
}

/** Rain scene — falling rain with lightning. */
function renderRainScene(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d')!;
  let time = 0;
  let drops: RainDrop[] = [];
  let lightningAlpha = 0;
  let nextLightning = 200 + Math.random() * 400;

  function init(): void {
    const w = canvas.width;
    const h = canvas.height;
    drops = [];
    for (let i = 0; i < 200; i++) {
      drops.push({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 8 + Math.random() * 8,
        length: 15 + Math.random() * 20,
        opacity: 0.1 + Math.random() * 0.3,
      });
    }
  }
  init();

  function frame(): void {
    const w = canvas.width;
    const h = canvas.height;
    time += 0.016;

    // Stormy sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0a0c12');
    skyGrad.addColorStop(0.3, '#111520');
    skyGrad.addColorStop(0.6, '#1a1e2e');
    skyGrad.addColorStop(1, '#0d1018');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Lightning flash
    if (time * 60 > nextLightning) {
      lightningAlpha = 0.6;
      nextLightning = time * 60 + 200 + Math.random() * 500;
    }
    if (lightningAlpha > 0) {
      ctx.fillStyle = `rgba(180, 190, 255, ${lightningAlpha})`;
      ctx.fillRect(0, 0, w, h);
      lightningAlpha *= 0.85;
      if (lightningAlpha < 0.01) {
        lightningAlpha = 0;
      }
    }

    // Cloud layer
    for (let i = 0; i < 5; i++) {
      const cx = (i / 5) * w + Math.sin(time * 0.1 + i * 3) * 40;
      const cy = h * 0.05 + Math.sin(time * 0.05 + i) * 20;
      const cw = 200 + Math.sin(i * 7.3) * 80;
      const ch = 60 + Math.sin(i * 4.1) * 20;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cw * 0.5);
      cloudGrad.addColorStop(0, 'rgba(30, 35, 50, 0.6)');
      cloudGrad.addColorStop(1, 'rgba(20, 25, 35, 0)');
      ctx.fillStyle = cloudGrad;
      ctx.fillRect(cx - cw, cy - ch, cw * 2, ch * 2);
    }

    // Rain drops
    ctx.lineCap = 'round';
    for (const d of drops) {
      d.y += d.speed;
      d.x -= 1; // Slight wind

      if (d.y > h) {
        d.y = -d.length;
        d.x = Math.random() * w;
      }
      if (d.x < -20) {
        d.x = w + 20;
      }

      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - 1.5, d.y + d.length);
      ctx.strokeStyle = `rgba(150, 170, 220, ${d.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Splash effects at bottom
    for (let i = 0; i < 15; i++) {
      const sx = (Math.sin(time * 3 + i * 17.3) * 0.5 + 0.5) * w;
      const sy = h - 10 - Math.random() * 5;
      const splashAlpha = 0.2 + 0.2 * Math.abs(Math.sin(time * 5 + i * 3.7));
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150, 170, 220, ${splashAlpha})`;
      ctx.fill();
    }

    _sceneAnimationId = requestAnimationFrame(frame);
  }
  frame();
  return () => {
    if (_sceneAnimationId !== null) {
      cancelAnimationFrame(_sceneAnimationId);
      _sceneAnimationId = null;
    }
  };
}

/** Map of scene ID to its render function. */
const SCENE_RENDERERS: Record<string, (canvas: HTMLCanvasElement) => () => void> = {
  stars: renderStarsScene,
  waves: renderWavesScene,
  aurora: renderAuroraScene,
  particles: renderParticlesScene,
  rain: renderRainScene,
};

/** Start a canvas scene animation on the given overlay. */
export function startSceneAnimation(overlay: HTMLElement, sceneId: string): void {
  removeSceneCanvas(overlay);
  const canvas = document.createElement('canvas');
  canvas.className = 'pres-canvas-bg';
  canvas.dataset['scene'] = sceneId;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.insertBefore(canvas, overlay.firstChild);

  const renderer = SCENE_RENDERERS[sceneId];
  if (renderer) {
    const cleanup = renderer(canvas);
    // Store the cleanup function so removeSceneCanvas can call it later
    if (typeof cleanup === 'function') {
      _sceneCleanup = cleanup;
    }
  }

  // Handle resize
  const onResize = (): void => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener('resize', onResize);
  // Store cleanup reference for the canvas element
  _cleanupMap.set(canvas, onResize);
}
