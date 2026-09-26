/**
 * Silent Catch Guard
 *
 * Enforces that production code (src/**, excluding __tests__) never swallows
 * errors without any feedback or graceful handling. Uses the TypeScript AST to
 * detect catch bodies that do nothing observable:
 *   - empty bodies / comment-only bodies
 *   - `void e;`
 *   - `return;` / `return undefined;` / `return null;`
 *   - expression-arrow handlers   `.catch(() => null | undefined | { })`
 *   - block handlers               `.catch(() => {})`
 *
 * Every detected site must be documented in config/silent-catches.allowed.json
 * with a reason. The guard fails when:
 *   1. a silent catch appears that is NOT allowlisted (a new swallow), or
 *   2. an allowlist entry no longer matches any detected site (stale entry), or
 *   3. a documented entry's shape changed (kind mismatch).
 *
 * Entries are keyed by a LOCATION-STABLE identity, never by line number:
 *   file :: enclosing function :: anchor
 * where anchor is the catch's own comment (the human intent marker) or, for
 * comment-less catches, a per-function occurrence index. Inserting or removing
 * lines above a documented catch therefore never breaks the build; adding a
 * new silent catch, or rewording a documented one, still does.
 *
 * Scan directory can be overridden with SILENT_SCAN_DIR for testing.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import ts from 'typescript';

const ROOT = process.cwd();
const SCAN_DIR = resolve(ROOT, process.env.SILENT_SCAN_DIR || 'src');
const ALLOWLIST_PATH = resolve(ROOT, 'config/silent-catches.allowed.json');

let hasErrors = false;

function isSilent(node) {
  if (!node) {
    return false;
  }
  if (ts.isExpressionStatement(node) && ts.isVoidExpression(node.expression)) {
    return true;
  }
  if (ts.isReturnStatement(node)) {
    if (!node.expression) {
      return { kind: 'catch-return-only' };
    }
    if (ts.isIdentifier(node.expression) && node.expression.text === 'undefined') {
      return { kind: 'catch-return-undefined' };
    }
    if (node.expression.kind === ts.SyntaxKind.NullKeyword) {
      return { kind: 'catch-return-null' };
    }
    if (ts.isVoidExpression(node.expression)) {
      return { kind: 'catch-void' };
    }
  }
  return false;
}

function classifyBlock(statements) {
  if (statements.length === 0) {
    return { kind: 'catch-empty-block' };
  }
  for (const s of statements) {
    const r = isSilent(s);
    if (!r) {
      return null;
    }
  }
  const nulls = statements.some(
    (s) => ts.isReturnStatement(s) && s.expression && s.expression.kind === ts.SyntaxKind.NullKeyword,
  );
  if (nulls) {
    return { kind: 'catch-return-null' };
  }
  const undefs = statements.some(
    (s) =>
      ts.isReturnStatement(s) && s.expression && ts.isIdentifier(s.expression) && s.expression.text === 'undefined',
  );
  if (undefs) {
    return { kind: 'catch-return-undefined' };
  }
  const voids = statements.some((s) => ts.isExpressionStatement(s) && ts.isVoidExpression(s.expression));
  if (voids) {
    return { kind: 'catch-void' };
  }
  return { kind: 'catch-return-only' };
}

function classifyArrowHandler(fn) {
  const body = fn.body;
  if (ts.isBlock(body)) {
    return classifyBlock(body.statements);
  }
  if (ts.isVoidExpression(body)) {
    return { kind: 'expression-arrow-void' };
  }
  let expr = body;
  if (ts.isParenthesizedExpression(expr)) {
    expr = expr.expression;
  }
  if (expr.kind === ts.SyntaxKind.NullKeyword) {
    return { kind: 'expression-arrow-null' };
  }
  if (ts.isIdentifier(expr) && expr.text === 'undefined') {
    return { kind: 'expression-arrow-undefined' };
  }
  if (ts.isObjectLiteralExpression(expr) && expr.properties.length === 0) {
    return { kind: 'expression-arrow-empty-object' };
  }
  return null;
}

function classifyHandler(fn) {
  if (ts.isArrowFunction(fn)) {
    return classifyArrowHandler(fn);
  }
  if (ts.isFunctionExpression(fn) && ts.isBlock(fn.body)) {
    return classifyBlock(fn.body.statements);
  }
  return null;
}

/** Name of the function/method a node sits in — the stable part of the key. */
function enclosingName(node) {
  let cur = node.parent;
  while (cur) {
    if (ts.isFunctionDeclaration(cur) && cur.name) {
      return cur.name.text;
    }
    if (ts.isMethodDeclaration(cur) && cur.name) {
      return cur.name.getText();
    }
    if (ts.isFunctionExpression(cur) || ts.isArrowFunction(cur)) {
      const p = cur.parent;
      if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) {
        return p.name.text;
      }
      if (p && ts.isPropertyAssignment(p) && ts.isIdentifier(p.name)) {
        return p.name.text;
      }
      if (p && ts.isCallExpression(p)) {
        const method = p.expression.getText().replace(/^.*\./, '').slice(0, 24);
        return `callback:${method}`;
      }
      return 'anonymous-fn';
    }
    cur = cur.parent;
  }
  return 'module-scope';
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, files);
    } else if (st.isFile() && name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function collectFiles() {
  return walk(SCAN_DIR)
    .filter((f) => !f.split(sep).includes('__tests__'))
    .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'))
    .sort();
}

const found = [];

for (const relFile of collectFiles()) {
  const content = readFileSync(join(ROOT, relFile), 'utf8');
  const sf = ts.createSourceFile(relFile, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const record = (node, kind) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const comment = (node.getText(sf).match(/\/\/[^\n]+|\/\*[\s\S]*?\*\//g) || [])
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    found.push({
      file: relFile,
      line: line + 1,
      kind,
      fn: enclosingName(node),
      comment,
    });
  };

  const visit = (node) => {
    if (ts.isCatchClause(node) && node.block) {
      const res = classifyBlock(node.block.statements);
      if (res) {
        record(node, res.kind);
      }
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'catch' &&
      node.arguments.length === 1
    ) {
      const res = classifyHandler(node.arguments[0]);
      if (res) {
        record(node, res.kind);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

// Build location-stable keys: comment anchor when present, otherwise a
// per-function occurrence index. Duplicate anchors inside one function get an
// index suffix so every site keeps a unique identity.
const perFnCommentCount = new Map();
const perFnSiteCount = new Map();
for (const site of found) {
  const fnKey = `${site.file}::${site.fn}`;
  const fnTotal = (perFnSiteCount.get(fnKey) || 0) + 1;
  perFnSiteCount.set(fnKey, fnTotal);
  if (site.comment) {
    const cKey = `${fnKey}::${site.comment}`;
    const n = (perFnCommentCount.get(cKey) || 0) + 1;
    perFnCommentCount.set(cKey, n);
    site.anchor = n > 1 ? `${site.comment}#${n}` : site.comment;
  } else {
    site.anchor = `#${fnTotal}`;
  }
  site.key = `${fnKey}::${site.anchor}`;
}

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')).entries || [];
const allowedKeys = new Map(allowlist.map((e) => [`${e.file}::${e.fn}::${e.anchor}`, e]));
const realKeys = new Set();

for (const site of found) {
  realKeys.add(site.key);
  const entry = allowedKeys.get(site.key);
  if (!entry) {
    console.error(
      `❌ [SilentCatch] Undocumented silent catch at ${site.file}:${site.line} in ${site.fn} (${site.kind})${site.comment ? ' — ' + site.comment : ''}`,
    );
    console.error('    Document it in config/silent-catches.allowed.json with a reason, or give it feedback.');
    hasErrors = true;
  } else if (entry.kind !== site.kind) {
    console.error(
      `❌ [SilentCatch] Kind mismatch in ${site.fn} (${site.file}:${site.line}): allowlist says "${entry.kind}", code is "${site.kind}"`,
    );
    hasErrors = true;
  }
}

for (const [key, entry] of allowedKeys) {
  if (!realKeys.has(key)) {
    console.error(
      `❌ [SilentCatch] Stale allowlist entry ${key} ("${entry.reason}") no longer matches any silent catch`,
    );
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error(
    `\n[SilentCatch] Detected ${found.length} silent catch site(s), allowlist has ${allowedKeys.size} entrie(s).`,
  );
  process.exit(1);
} else {
  console.log(`✅ [SilentCatch] Passed: ${found.length} documented silent catch site(s); no undocumented swallows.`);
}
