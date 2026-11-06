import { __ } from '../../i18n.js';

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
  // Performance: Use Intersection Observer to delay background image loading
  // until the layer is actually visible (saves bandwidth on mobile)
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          layer.style.backgroundImage = `url('${bgSrc}')`;
          observer.disconnect();
        }
      }
    },
    { rootMargin: '100px' },
  );
  observer.observe(layer);
  overlay.insertBefore(layer, overlay.firstChild);
}

// Canvas animated scenes moved to ./pres-scene-canvas.ts — re-exported so existing
// import sites keep working.
export { removeSceneCanvas, startSceneAnimation } from './pres-scene-canvas.js';
