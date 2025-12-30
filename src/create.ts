/**
 * create-inner-lens
 *
 * Wrapper for `npx create-inner-lens` that runs `inner-lens init`.
 *
 * Usage:
 *   npx create-inner-lens
 *   npx create-inner-lens -y
 *   npx create-inner-lens --provider openai
 */

import { spawn } from 'child_process';
import path from 'path';

// In CJS context, __dirname is available after tsup bundling
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - __dirname is injected by tsup for CJS
const currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

// Run inner-lens init with all passed arguments
const cliPath = path.resolve(currentDir, 'cli.cjs');
const args = ['init', ...process.argv.slice(2)];

const child = spawn(process.execPath, [cliPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd(),
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});
