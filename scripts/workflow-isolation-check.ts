#!/usr/bin/env tsx
/**
 * Workflow Isolation Checker
 *
 * Validates that analysis-engine.yml correctly isolates npm dependencies.
 * Simulates a caller repository with conflicting peer dependencies.
 *
 * Usage: npx tsx scripts/workflow-isolation-check.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

interface CheckResult {
  success: boolean;
  message: string;
  details?: string;
}

function parseWorkflowDeps(workflowPath: string): string[] {
  const content = fs.readFileSync(workflowPath, 'utf-8');

  const installMatch = content.match(/npm install[^\\]*(?:\\[\s\S]*?)+(?=\n\s*\n|\n\s+-)/);
  if (!installMatch) return [];

  const deps: string[] = [];
  const lines = installMatch[0].split('\n');
  for (const line of lines) {
    const depMatch = line.match(/^\s*([a-z@][a-z0-9@/._-]*@[~^]?[\d.]+)/i);
    if (depMatch?.[1]) {
      deps.push(depMatch[1]);
    }
  }
  return deps;
}

function checkWorkingDirectory(): CheckResult {
  const workflowPath = path.join(projectRoot, '.github/workflows/analysis-engine.yml');
  const content = fs.readFileSync(workflowPath, 'utf-8');

  const hasWorkingDir = content.includes('working-directory: .inner-lens');
  const hasIsolatedPackageJson = content.includes('echo \'{') && content.includes('package.json');

  if (!hasWorkingDir) {
    return {
      success: false,
      message: 'Missing working-directory: .inner-lens',
      details: 'npm install should run in .inner-lens to avoid caller package.json',
    };
  }

  if (!hasIsolatedPackageJson) {
    return {
      success: false,
      message: 'Missing isolated package.json creation',
      details: 'Should create minimal package.json to prevent npm parent directory search',
    };
  }

  return { success: true, message: 'Dependency installation is properly isolated' };
}

function checkNodePath(): CheckResult {
  const workflowPath = path.join(projectRoot, '.github/workflows/analysis-engine.yml');
  const content = fs.readFileSync(workflowPath, 'utf-8');

  const hasNodePath = content.includes('NODE_PATH:') && content.includes('.inner-lens/node_modules');
  const hasPathExport = content.includes('export PATH=') && content.includes('.inner-lens/node_modules/.bin');

  const issues: string[] = [];
  if (!hasNodePath) issues.push('NODE_PATH not set to .inner-lens/node_modules');
  if (!hasPathExport) issues.push('PATH not modified to include .inner-lens/node_modules/.bin');

  if (issues.length > 0) {
    return {
      success: false,
      message: 'Module resolution not properly isolated',
      details: issues.join('\n'),
    };
  }

  return { success: true, message: 'Module resolution is properly isolated' };
}

function checkVersionPinning(): CheckResult {
  const workflowPath = path.join(projectRoot, '.github/workflows/analysis-engine.yml');
  const deps = parseWorkflowDeps(workflowPath);

  const looseVersions = deps.filter((dep) => dep.includes('@^'));

  if (looseVersions.length > 0) {
    return {
      success: false,
      message: 'Some dependencies use caret (^) versioning',
      details: `Consider using tilde (~) for stability:\n${looseVersions.join('\n')}`,
    };
  }

  return { success: true, message: 'All dependencies use tilde (~) or exact versions' };
}

function simulateConflictingEnvironment(): CheckResult {
  const tempDir = fs.mkdtempSync('/tmp/inner-lens-test-');

  try {
    const conflictingPackageJson = {
      name: 'conflict-test',
      private: true,
      dependencies: {
        '@typescript-eslint/eslint-plugin': '^8.0.0',
        eslint: '^9.0.0',
      },
    };

    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(conflictingPackageJson, null, 2));

    const innerLensDir = path.join(tempDir, '.inner-lens');
    fs.mkdirSync(innerLensDir, { recursive: true });

    const isolatedPackageJson = { name: 'inner-lens-analysis', private: true, type: 'module' };
    fs.writeFileSync(path.join(innerLensDir, 'package.json'), JSON.stringify(isolatedPackageJson, null, 2));

    try {
      execSync('npm install --no-save ai@~6.0.12 zod@~3.25.76', {
        cwd: innerLensDir,
        stdio: 'pipe',
        timeout: 60000,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: 'npm install failed in isolated environment',
        details: errorMsg,
      };
    }

    const nodeModulesExists = fs.existsSync(path.join(innerLensDir, 'node_modules'));
    const parentNodeModulesExists = fs.existsSync(path.join(tempDir, 'node_modules'));

    if (!nodeModulesExists) {
      return {
        success: false,
        message: 'node_modules not created in .inner-lens',
      };
    }

    if (parentNodeModulesExists) {
      return {
        success: false,
        message: 'node_modules leaked to parent directory',
        details: 'Isolation failed - deps installed in caller repo root',
      };
    }

    return { success: true, message: 'Simulated conflicting environment passed' };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runChecks(): void {
  console.log('\n🔍 Workflow Isolation Check\n');
  console.log('━'.repeat(60));

  const checks = [
    { name: 'Working Directory Isolation', fn: checkWorkingDirectory },
    { name: 'Module Resolution Isolation', fn: checkNodePath },
    { name: 'Version Pinning', fn: checkVersionPinning },
    { name: 'Conflict Simulation', fn: simulateConflictingEnvironment },
  ];

  let allPassed = true;

  for (const check of checks) {
    console.log(`\n📋 ${check.name}`);
    const result = check.fn();

    if (result.success) {
      console.log(`   ✅ ${result.message}`);
    } else {
      console.log(`   ❌ ${result.message}`);
      if (result.details) {
        console.log(`      ${result.details.split('\n').join('\n      ')}`);
      }
      allPassed = false;
    }
  }

  console.log('\n' + '━'.repeat(60));

  if (allPassed) {
    console.log('\n✅ All isolation checks passed!\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some isolation checks failed!\n');
    process.exit(1);
  }
}

runChecks();
