#!/usr/bin/env node
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const SUPABASE_MIGRATIONS = path.join(ROOT, 'frontend', 'supabase', 'migrations');
const SQLITE_MIGRATIONS = path.join(ROOT, 'backend', 'sqlite', 'migrations');

const typeReplacements: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\buuid\b/gi, replacement: 'TEXT' },
  { pattern: /\bserial\b/gi, replacement: 'INTEGER' },
  { pattern: /\bbigserial\b/gi, replacement: 'INTEGER' },
  { pattern: /\bbigint\b/gi, replacement: 'INTEGER' },
  { pattern: /\binteger\b/gi, replacement: 'INTEGER' },
  { pattern: /\bboolean\b/gi, replacement: 'INTEGER' },
  { pattern: /\btimestamptz\b/gi, replacement: 'TEXT' },
  { pattern: /\btimestamp with time zone\b/gi, replacement: 'TEXT' },
  { pattern: /\btimestamp without time zone\b/gi, replacement: 'TEXT' },
  { pattern: /\bjsonb\b/gi, replacement: 'TEXT' },
  { pattern: /\bjson\b/gi, replacement: 'TEXT' },
  { pattern: /\bdouble precision\b/gi, replacement: 'REAL' },
];

const stripPatterns: RegExp[] = [
  /SET\s+search_path[^;]+;/gi,
  /SELECT\s+pg_catalog\.set_config[^;]+;/gi,
  /ALTER\s+DEFAULT\s+PRIVILEGES[^;]+;/gi,
  /COMMENT\s+ON\s+[^;]+;/gi,
  /CREATE\s+EXTENSION[^;]+;/gi,
];

async function ensureOutputDir() {
  await fs.mkdir(SQLITE_MIGRATIONS, { recursive: true });
}

function convertSql(sql: string, sourceFile: string) {
  let converted = sql.replace(/public\./g, '');

  stripPatterns.forEach((pattern) => {
    converted = converted.replace(pattern, '');
  });

  typeReplacements.forEach(({ pattern, replacement }) => {
    converted = converted.replace(pattern, replacement);
  });

  // Remove Postgres-specific enums (placeholder for manual handling)
  converted = converted.replace(/CREATE\s+TYPE[\s\S]+?\);/gi, '-- NOTE: enum definition requires manual conversion');

  const banner = `-- Auto-generated from ${sourceFile}\n-- Review required: verify constraints and triggers for SQLite compatibility.\n\n`;
  return banner + converted.trim() + '\n';
}

async function generate() {
  await ensureOutputDir();
  const entries = await fs.readdir(SUPABASE_MIGRATIONS);
  const sqlFiles = entries.filter((name) => name.endsWith('.sql')).sort();

  if (sqlFiles.length === 0) {
    console.warn('No Supabase migrations found.');
    return;
  }

  await Promise.all(
    sqlFiles.map(async (file) => {
      const sourcePath = path.join(SUPABASE_MIGRATIONS, file);
      const targetPath = path.join(SQLITE_MIGRATIONS, file);
      const raw = await fs.readFile(sourcePath, 'utf-8');
      const converted = convertSql(raw, file);
      await fs.writeFile(targetPath, converted, 'utf-8');
      console.log(`Generated ${path.relative(ROOT, targetPath)}`);
    })
  );
}

generate().catch((err) => {
  console.error('Failed to generate SQLite schema.', err);
  process.exitCode = 1;
});
