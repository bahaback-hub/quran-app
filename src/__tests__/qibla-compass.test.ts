import { beforeEach, describe, expect, it, vi } from 'vitest';

const { plugin } = vi.hoisted(() => ({
  plugin: {
    addListener: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => plugin),
}));

import { startNativeQiblaCompass } from '../qibla-compass.js';

const options = { latitude: 24.7136, longitude: 46.6753, altitude: 612 };

beforeEach(() => {
  vi.clearAllMocks();
  plugin.start.mockResolvedValue({ source: 'android', declination: 3.2 });
  plugin.stop.mockResolvedValue(undefined);
});

describe('startNativeQiblaCompass', () => {
  it('registers heading and accuracy listeners before starting the true-north stream', async () => {
    const removeHeading = vi.fn().mockResolvedValue(undefined);
    const removeAccuracy = vi.fn().mockResolvedValue(undefined);
    plugin.addListener.mockResolvedValueOnce({ remove: removeHeading }).mockResolvedValueOnce({ remove: removeAccuracy });
    const onHeading = vi.fn();
    const onAccuracy = vi.fn();

    const cleanup = await startNativeQiblaCompass(options, { onHeading, onAccuracy });

    expect(plugin.addListener).toHaveBeenNthCalledWith(1, 'headingChange', onHeading);
    expect(plugin.addListener).toHaveBeenNthCalledWith(2, 'accuracyChange', onAccuracy);
    expect(plugin.start).toHaveBeenCalledWith(options);

    await cleanup();
    expect(removeHeading).toHaveBeenCalledTimes(1);
    expect(removeAccuracy).toHaveBeenCalledTimes(1);
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });

  it('removes both listeners and preserves the original error when stream startup fails', async () => {
    const removeHeading = vi.fn().mockResolvedValue(undefined);
    const removeAccuracy = vi.fn().mockResolvedValue(undefined);
    const startupFailure = new Error('Native compass unavailable');
    plugin.addListener.mockResolvedValueOnce({ remove: removeHeading }).mockResolvedValueOnce({ remove: removeAccuracy });
    plugin.start.mockRejectedValueOnce(startupFailure);

    await expect(
      startNativeQiblaCompass(options, {
        onHeading: vi.fn(),
        onAccuracy: vi.fn(),
      }),
    ).rejects.toThrow('Native compass unavailable');

    expect(removeHeading).toHaveBeenCalledTimes(1);
    expect(removeAccuracy).toHaveBeenCalledTimes(1);
    expect(plugin.stop).not.toHaveBeenCalled();
  });

  it('completes cleanup even if one native cleanup operation rejects', async () => {
    const removeHeading = vi.fn().mockRejectedValue(new Error('listener already removed'));
    const removeAccuracy = vi.fn().mockResolvedValue(undefined);
    plugin.addListener.mockResolvedValueOnce({ remove: removeHeading }).mockResolvedValueOnce({ remove: removeAccuracy });

    const cleanup = await startNativeQiblaCompass(options, {
      onHeading: vi.fn(),
      onAccuracy: vi.fn(),
    });

    await expect(cleanup()).resolves.toBeUndefined();
    expect(removeHeading).toHaveBeenCalledTimes(1);
    expect(removeAccuracy).toHaveBeenCalledTimes(1);
    expect(plugin.stop).toHaveBeenCalledTimes(1);
  });
});
