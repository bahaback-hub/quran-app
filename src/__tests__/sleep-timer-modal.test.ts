/**
 * Tests for sleep-timer-modal.ts — Custom sleep timer modal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the a11y module
vi.mock('../a11y.js', () => ({
  trapFocus: vi.fn(() => vi.fn()), // Returns a cleanup function
}));

import { showSleepTimerModal, type AudioModule } from '../sleep-timer-modal.js';
import { trapFocus } from '../a11y.js';

describe('sleep-timer-modal', () => {
  let audioModule: AudioModule;

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';

    audioModule = {
      setSleepTimer: vi.fn(),
    };
  });

  /* ===================== showSleepTimerModal ===================== */

  describe('showSleepTimerModal', () => {
    it('should create and append a modal overlay to the document body', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal');
      expect(modal).not.toBeNull();
      expect(modal?.tagName).toBe('DIV');
    });

    it('should set correct ARIA attributes on the overlay', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal');
      expect(modal?.getAttribute('role')).toBe('dialog');
      expect(modal?.getAttribute('aria-modal')).toBe('true');
      expect(modal?.getAttribute('aria-label')).toBe('sleep_timer_title');
    });

    it('should remove any existing modal before creating a new one', () => {
      showSleepTimerModal(audioModule);
      const firstModal = document.getElementById('sleepTimerModal');

      showSleepTimerModal(audioModule);
      const secondModal = document.getElementById('sleepTimerModal');

      // There should only be one modal
      const allModals = document.querySelectorAll('#sleepTimerModal');
      expect(allModals.length).toBe(1);
      expect(secondModal).not.toBe(firstModal);
    });

    it('should create a modal with title, input, hint, buttons, and quick buttons', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;

      // Title
      const title = modal.querySelector('.modal-title');
      expect(title).not.toBeNull();
      expect(title?.textContent).toBe('sleep_timer_title');

      // Input
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input?.type).toBe('number');
      expect(input?.min).toBe('1');
      expect(input?.max).toBe('180');
      expect(input?.value).toBe('15');

      // Hint
      const hint = modal.querySelector('.modal-hint');
      expect(hint).not.toBeNull();
      expect(hint?.textContent).toBe('sleep_timer_hint');

      // Confirm button
      const confirmBtn = modal.querySelector('.btn-gold');
      expect(confirmBtn).not.toBeNull();
      expect(confirmBtn?.textContent).toBe('sleep_timer_confirm');

      // Cancel button
      const cancelBtn = modal.querySelector('.modal-btn-cancel');
      expect(cancelBtn).not.toBeNull();
      expect(cancelBtn?.textContent).toBe('sleep_timer_cancel');

      // Quick buttons
      const quickBtns = modal.querySelector('.modal-quick-btns');
      expect(quickBtns).not.toBeNull();
    });

    it('should create 6 quick buttons for preset times', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');
      expect(quickBtns.length).toBe(6);
    });

    it('should set input value when quick button is clicked', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');

      // Click the 30-minute button (index 3 for [5, 10, 15, 30, 45, 60])
      (quickBtns[3] as HTMLElement).click();

      expect(input.value).toBe('30');
    });

    it('should set input to 5 when first quick button is clicked', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');

      (quickBtns[0] as HTMLElement).click();

      expect(input.value).toBe('5');
    });

    it('should set input to 60 when last quick button is clicked', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');

      (quickBtns[5] as HTMLElement).click();

      expect(input.value).toBe('60');
    });

    it('should set input to 10 when second quick button is clicked', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');

      (quickBtns[1] as HTMLElement).click();

      expect(input.value).toBe('10');
    });

    it('should set input to 45 when fifth quick button is clicked', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');

      (quickBtns[4] as HTMLElement).click();

      expect(input.value).toBe('45');
    });

    it('should set sleep timer and close modal when confirm is clicked with valid input', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '20';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(20);
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should close modal without setting timer when input is invalid', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = 'abc'; // Not a number
      confirmBtn.click();

      expect(audioModule.setSleepTimer).not.toHaveBeenCalled();
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should close modal without setting timer when input is zero or negative', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '-5';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).not.toHaveBeenCalled();
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should close modal without setting timer when input is zero', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '0';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).not.toHaveBeenCalled();
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should enforce max value of 180 minutes', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '999';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(180);
    });

    it('should enforce max value for very large numbers', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '99999';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(180);
    });

    it('should close modal when cancel button is clicked', () => {
      showSleepTimerModal(audioModule);

      const cancelBtn = document.querySelector('.modal-btn-cancel') as HTMLElement;
      cancelBtn.click();

      expect(audioModule.setSleepTimer).not.toHaveBeenCalled();
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should close modal when clicking the overlay background', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      // Simulate clicking on the overlay itself (not on the modal box)
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: overlay });
      overlay.dispatchEvent(clickEvent);

      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should not close modal when clicking inside the modal box', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      const box = overlay.querySelector('.modal-box') as HTMLElement;

      // Simulate clicking inside the modal box
      const clickEvent = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(clickEvent, 'target', { value: box });
      overlay.dispatchEvent(clickEvent);

      // Modal should still exist
      expect(document.getElementById('sleepTimerModal')).not.toBeNull();
    });

    it('should close modal on Escape key', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      overlay.dispatchEvent(escapeEvent);

      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should not close modal on non-Escape key', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      overlay.dispatchEvent(enterEvent);

      expect(document.getElementById('sleepTimerModal')).not.toBeNull();
    });

    it('should call trapFocus on the overlay', () => {
      showSleepTimerModal(audioModule);

      expect(trapFocus).toHaveBeenCalled();
      const overlay = document.getElementById('sleepTimerModal');
      expect(trapFocus).toHaveBeenCalledWith(overlay);
    });

    it('should call focusCleanup on close', () => {
      const mockCleanup = vi.fn();
      (trapFocus as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

      showSleepTimerModal(audioModule);

      const cancelBtn = document.querySelector('.modal-btn-cancel') as HTMLElement;
      cancelBtn.click();

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should call focusCleanup on Escape close', () => {
      const mockCleanup = vi.fn();
      (trapFocus as ReturnType<typeof vi.fn>).mockReturnValue(mockCleanup);

      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      overlay.dispatchEvent(escapeEvent);

      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should set input placeholder correctly', () => {
      showSleepTimerModal(audioModule);

      const input = document.querySelector('.modal-input') as HTMLInputElement;
      expect(input.placeholder).toBe('sleep_timer_placeholder');
    });

    it('should set correct classes on overlay and modal', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      expect(overlay.classList.contains('modal-overlay')).toBe(true);

      const box = overlay.querySelector('.modal-box');
      expect(box).not.toBeNull();
    });

    it('should handle confirm with valid minimum value (1)', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '1';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(1);
    });

    it('should handle confirm with boundary value (180)', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '180';
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(180);
    });

    it('should handle NaN input gracefully', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '';
      confirmBtn.click();

      // Empty input results in NaN, which should close without setting timer
      expect(audioModule.setSleepTimer).not.toHaveBeenCalled();
      expect(document.getElementById('sleepTimerModal')).toBeNull();
    });

    it('should handle float input by truncating to integer', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const input = modal.querySelector('.modal-input') as HTMLInputElement;
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      input.value = '15.7';
      confirmBtn.click();

      // parseInt should parse '15.7' as 15
      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(15);
    });

    it('should use default value of 15 for the input', () => {
      showSleepTimerModal(audioModule);

      const input = document.querySelector('.modal-input') as HTMLInputElement;
      expect(input.value).toBe('15');
    });

    it('should confirm with default value of 15 minutes', () => {
      showSleepTimerModal(audioModule);

      const confirmBtn = document.querySelector('.btn-gold') as HTMLElement;
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(15);
    });

    it('should handle quick button then confirm flow', () => {
      showSleepTimerModal(audioModule);

      const modal = document.getElementById('sleepTimerModal')!;
      const quickBtns = modal.querySelectorAll('.modal-quick-btn');
      const confirmBtn = modal.querySelector('.btn-gold') as HTMLElement;

      // Click 60 min quick button
      (quickBtns[5] as HTMLElement).click();
      confirmBtn.click();

      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(60);
    });

    it('should prevent default on Escape keydown event', () => {
      showSleepTimerModal(audioModule);

      const overlay = document.getElementById('sleepTimerModal')!;
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      const spy = vi.spyOn(escapeEvent, 'preventDefault');
      overlay.dispatchEvent(escapeEvent);

      expect(spy).toHaveBeenCalled();
    });

    it('should handle modal being opened after a previous modal was closed', () => {
      showSleepTimerModal(audioModule);
      const cancelBtn = document.querySelector('.modal-btn-cancel') as HTMLElement;
      cancelBtn.click();
      expect(document.getElementById('sleepTimerModal')).toBeNull();

      // Open again
      showSleepTimerModal(audioModule);
      expect(document.getElementById('sleepTimerModal')).not.toBeNull();

      // Confirm it works
      const confirmBtn = document.querySelector('.btn-gold') as HTMLElement;
      confirmBtn.click();
      expect(audioModule.setSleepTimer).toHaveBeenCalledWith(15);
    });
  });
});
