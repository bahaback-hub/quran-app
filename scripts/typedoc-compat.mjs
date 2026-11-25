// TypeDoc 0.28 calls Minimatch#matchOne(), which minimatch 11 removed while
// fixing the GHSA-g3hv-75wg-m249 advisory. This tiny compatibility shim keeps
// the patched minimatch 11 (so npm audit stays clean) and restores the partial
// prefix match TypeDoc needs while walking directories.
import { Minimatch, minimatch } from 'minimatch';

if (typeof Minimatch.prototype.matchOne !== 'function') {
  Minimatch.prototype.matchOne = function matchOne(file, _row, partial) {
    const target = Array.isArray(file) ? file.join('/') : file;
    return minimatch(target, this.pattern, {
      dot: Boolean(this.options && this.options.dot),
      partial: Boolean(partial),
    });
  };
}
