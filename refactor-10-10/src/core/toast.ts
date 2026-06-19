/**
 * ================================================================
 * Toast Notification
 * ----------------------------------------------------------------
 * Simple toast system used by Error Boundary and EventBus.
 * ================================================================
 */

class ToastManager {
  private el: HTMLElement | null = null;
  private timeout: number | null = null;

  show(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info', duration = 3000): void {
    if (!this.el) {
      this.el = document.getElementById('toast');
      if (!this.el) {
        console.warn('[Toast] #toast element not found in DOM.');
        return;
      }
    }

    this.el.textContent = message;
    this.el.className = `toast show toast-${type}`;

    if (this.timeout) {
      window.clearTimeout(this.timeout);
    }
    this.timeout = window.setTimeout(() => {
      this.el?.classList.remove('show');
    }, duration);
  }

  info(message: string, duration?: number): void {
    this.show(message, 'info', duration);
  }
  success(message: string, duration?: number): void {
    this.show(message, 'success', duration);
  }
  error(message: string, duration?: number): void {
    this.show(message, 'error', duration ?? 5000);
  }
  warning(message: string, duration?: number): void {
    this.show(message, 'warning', duration);
  }
}

export const toast = new ToastManager();
