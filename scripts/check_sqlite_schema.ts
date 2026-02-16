#!/usr/bin/env node
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    ...options,
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

try {
  run('npm', ['run', 'gen:sqlite', '--silent'], { cwd: FRONTEND });

  const status = spawnSync(
    'git',
    ['status', '--porcelain', 'backend/sqlite/migrations'],
    { cwd: ROOT, encoding: 'utf-8' }
  );

  if (status.status !== 0) {
    throw new Error('git status failed');
  }

  if (status.stdout.trim().length > 0) {
    console.error('\nSQLite migrations are out of sync with Supabase migrations.');
    console.error('Run "npm run gen:sqlite" from frontend/, commit the changes, and rerun.');
    process.exit(1);
  }

  console.log('SQLite migrations are up to date.');
} catch (err) {
  if (!process.exitCode) {
    process.exitCode = 1;
  }
  console.error(err instanceof Error ? err.message : err);
}
