export interface CapacitorCssWebOnlyPlugin {
  name: string;
  enforce: 'pre';
  transform(code: string, id: string): string | null;
}

/**
 * Drop `capacitor.css` from web builds. See the implementation for why that is
 * safe and why it must stay a build-time edit rather than a lazy import.
 */
export function capacitorCssWebOnly(isCapacitorBuild: boolean): CapacitorCssWebOnlyPlugin;
