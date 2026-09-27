/**
 * Drop `capacitor.css` from web builds.
 *
 * Every rule in that file except one is scoped to `body.capacitor-native`, a
 * class `src/main.ts` only adds inside the Android WebView, so on the web the
 * whole file is inert weight in the render-blocking bundle. The single unscoped
 * rule defines `--capacitor-player-offset`, and the only rules that read it are
 * the `body.capacitor-native` ones in the same file, so nothing on the web ever
 * resolves it.
 *
 * This is a build-time edit rather than a runtime decision on purpose: the file
 * is not lazily loaded, so there is no window in which the page could render
 * before its styles arrive - unlike splitting a stylesheet into a dynamic chunk,
 * where the module can execute before its stylesheet has been applied.
 *
 * The Android build is left completely untouched.
 */

const CAPACITOR_IMPORT = /@import\s+['"]\.\/src\/css\/capacitor\.css['"];?[ \t]*\r?\n?/;
const IS_ENTRY_STYLESHEET = /(^|[\\/])styles\.css$/;

/**
 * @param {boolean} isCapacitorBuild When true the plugin does nothing.
 */
export function capacitorCssWebOnly(isCapacitorBuild) {
  return {
    name: 'capacitor-css-web-only',
    enforce: 'pre',
    /**
     * @param {string} code
     * @param {string} id
     * @returns {string | null}
     */
    transform(code, id) {
      if (isCapacitorBuild) {
        return null;
      }
      if (!IS_ENTRY_STYLESHEET.test(id.split('?')[0])) {
        return null;
      }
      return code.replace(CAPACITOR_IMPORT, '');
    },
  };
}
