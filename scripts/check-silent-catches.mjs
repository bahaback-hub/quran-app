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
 *   2. an allowlist entry no longer matches any detected site (stale entry).
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
  if (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn) || ts.isFunctionDeclaration(fn)) {
    if (ts.isArrowFunction(fn)) {
      return classifyArrowHandler(fn);
    }
    if (ts.isBlock(fn.body)) {
      return classifyBlock(fn.body.statements);
    }
  }
  return null;
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

const found = new Map();

for (const relFile of collectFiles()) {
  const content = readFileSync(join(ROOT, relFile), 'utf8');
  const sf = ts.createSourceFile(relFile, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  const record = (node, kind) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    const comment =
      kind === 'catch-empty-block' && ts.isCatchClause(node)
        ? (node.block.getText(sf).match(/(?:\/\/[^\n]+|\/\*[^*]*\*\/)/g) || []).join(' | ')
        : '';
    found.set(`${relFile}:${line + 1}`, { file: relFile, line: line + 1, kind, comment });
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
        record(node.expression.name, res.kind);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')).entries || [];
const allowedKeys = new Map(allowlist.map((e) => [`${e.file}:${e.line}`, e]));

for (const [key, site] of found) {
  const entry = allowedKeys.get(key);
  if (!entry) {
    console.error(
      `❌ [SilentCatch] Undocumented silent catch at ${key} (${site.kind})${site.comment ? ' — ' + site.comment : ''}`,
    );
    console.error('    Add it to config/silent-catches.allowed.json with a reason, or give it feedback.');
    hasErrors = true;
  } else if (entry.kind !== site.kind) {
    console.error(`❌ [SilentCatch] Kind mismatch at ${key}: allowlist says "${entry.kind}", code is "${site.kind}"`);
    hasErrors = true;
  }
}

for (const [key, entry] of allowedKeys) {
  if (!found.has(key)) {
    console.error(
      `❌ [SilentCatch] Stale allowlist entry ${key} ("${entry.reason}") no longer matches any silent catch`,
    );
    hasErrors = true;
  }
}

if (hasErrors) {
  console.error(
    `\n[SilentCatch] Detected ${found.size} silent catch site(s), allowlist has ${allowedKeys.size} entrie(s).`,
  );
  process.exit(1);
} else {
  console.log(`✅ [SilentCatch] Passed: ${found.size} documented silent catch site(s); no undocumented swallows.`);
}
