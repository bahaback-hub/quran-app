import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Launch TypeDoc through a wrapper that preloads the minimatch 11 compat shim.
// NODE_OPTIONS --import is used because TypeDoc's bin forks a child process,
// and TypeDoc loads the ESM build of minimatch (different from a CJS require).
const compatPath = fileURLToPath(new URL('./typedoc-compat.mjs', import.meta.url));
const compatUrl = pathToFileURL(compatPath).href;
const nodeOptions = [process.env.NODE_OPTIONS, `--import "${compatUrl}"`].filter(Boolean).join(' ');
const binPath = fileURLToPath(new URL('../node_modules/typedoc/bin/typedoc', import.meta.url));

const result = spawnSync(process.execPath, [binPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

process.exit(result.status ?? 1);
