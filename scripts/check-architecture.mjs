import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TARGET_ROOTS = ['modules'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);
const IMPORT_RE = /(?:import\s+[^'"`]*?from\s+|import\s*\(\s*)['"]([^'"]+)['"]\s*\)?/g;

const violations = [];

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'lib') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    const ext = path.extname(entry.name);
    if (SOURCE_EXTENSIONS.has(ext)) acc.push(fullPath);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll('\\\\', '/');
}

function parseModuleInfo(filePath) {
  const parts = rel(filePath).split('/');
  if (parts[0] !== 'modules' || parts.length < 3) return null;
  return {
    module: parts[1],
    layer: parts[2],
    relPath: rel(filePath),
  };
}

function resolveImport(fromFile, specifier) {
  if (specifier.startsWith('.')) {
    const base = path.resolve(path.dirname(fromFile), specifier);
    const withExt = ['.ts', '.tsx', '.js', '.mjs', '.cjs'].map(ext => `${base}${ext}`);
    const asIndex = ['index.ts', 'index.tsx', 'index.js'].map(name => path.join(base, name));
    const candidates = [base, ...withExt, ...asIndex];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
  }

  if (specifier.startsWith('modules/')) {
    return path.join(ROOT, specifier);
  }

  return null;
}

function isApiImport(specifier, targetRel) {
  return specifier.endsWith('/api') || specifier.endsWith('/api.ts') || targetRel.endsWith('/api.ts');
}

function isAdminManifestImport(specifier, targetRel) {
  return (
    specifier.endsWith('/admin.manifest') ||
    specifier.endsWith('/admin.manifest.ts') ||
    targetRel.endsWith('/admin.manifest.ts')
  );
}

function isOwnModuleApiImport(importer, targetInfo, targetRel, specifier) {
  return importer.module === targetInfo.module && isApiImport(specifier, targetRel);
}

function addViolation(file, specifier, message) {
  violations.push(`${rel(file)} -> ${specifier}: ${message}`);
}

const files = TARGET_ROOTS.flatMap(root => walk(path.join(ROOT, root)));

for (const file of files) {
  const importer = parseModuleInfo(file);
  if (!importer) continue;

  const content = fs.readFileSync(file, 'utf8');
  const matches = [...content.matchAll(IMPORT_RE)];

  for (const m of matches) {
    const specifier = m[1];
    if (!specifier) continue;

    if (importer.layer === 'logic' && (specifier === 'firebase' || specifier.startsWith('firebase/'))) {
      addViolation(file, specifier, 'logic must not import Firebase');
    }

    const resolved = resolveImport(file, specifier);
    if (!resolved) continue;

    const targetInfo = parseModuleInfo(resolved);
    if (!targetInfo) continue;

    const targetRel = rel(resolved);

    // UI layer can import from:
    // 1. Its own module's api.ts
    // 2. Other UI components in the same module (for composition)
    // But NOT from logic or data layers
    if (
      importer.layer === 'ui' &&
      targetInfo.module === importer.module &&
      (targetInfo.layer === 'logic' || targetInfo.layer === 'data') &&
      !isOwnModuleApiImport(importer, targetInfo, targetRel, specifier)
    ) {
      addViolation(file, specifier, `ui layer must not import ${targetInfo.layer} layer directly (use api.ts)`);
    }

    if (importer.layer === 'logic' && targetInfo.module === importer.module && targetInfo.layer === 'data') {
      addViolation(file, specifier, 'logic layer must not import data layer');
    }

    if (
      targetInfo.module !== importer.module &&
      !isApiImport(specifier, targetRel) &&
      !isAdminManifestImport(specifier, targetRel)
    ) {
      addViolation(file, specifier, 'cross-module import must target api.ts only');
    }
  }
}

if (violations.length > 0) {
  console.error('\nArchitecture boundary violations found:\n');
  for (const v of violations) console.error(`- ${v}`);
  process.exit(1);
}

console.log('Architecture boundary check passed.');
