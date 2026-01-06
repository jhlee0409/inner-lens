#!/usr/bin/env tsx
/**
 * Sparse Checkout Dependency Checker
 *
 * Validates that all imports in scripts/ are included in sparse-checkout config.
 * Prevents ERR_MODULE_NOT_FOUND in consumer repos using analysis-engine.yml.
 *
 * Usage: npx tsx scripts/sparse-checkout-check.ts
 * Exit: 0 = OK, 1 = Missing dependencies
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveTypescriptPath(filePath: string, projectRoot?: string): string {
  const candidates: string[] = [];

  if (filePath.endsWith('.js')) {
    candidates.push(filePath.replace(/\.js$/, '.ts'));
    candidates.push(filePath.replace(/\.js$/, '.tsx'));
    candidates.push(filePath);
  } else if (filePath.endsWith('.jsx')) {
    candidates.push(filePath.replace(/\.jsx$/, '.tsx'));
    candidates.push(filePath);
  } else if (filePath.endsWith('.mjs')) {
    candidates.push(filePath.replace(/\.mjs$/, '.mts'));
    candidates.push(filePath);
  } else if (!path.extname(filePath)) {
    candidates.push(filePath + '.ts');
    candidates.push(filePath + '.tsx');
    candidates.push(filePath + '/index.ts');
    candidates.push(filePath + '/index.tsx');
    candidates.push(filePath + '.js');
  } else {
    candidates.push(filePath);
  }

  if (projectRoot) {
    for (const candidate of candidates) {
      if (fs.existsSync(path.join(projectRoot, candidate))) {
        return candidate;
      }
    }
  }

  return candidates[0] ?? filePath;
}

export interface ImportDependency {
  sourceFile: string;
  importPath: string;
  resolvedPath: string;
  line: number;
}

export interface SparseCheckoutConfig {
  paths: string[];
  workflowFile: string;
}

export interface CheckResult {
  status: 'ok' | 'missing' | 'error';
  dependency: ImportDependency;
  includedInSparseCheckout: boolean;
  message?: string;
}

export interface ValidationResult {
  success: boolean;
  totalImports: number;
  externalDependencies: number;
  missingDependencies: number;
  results: CheckResult[];
  errors: string[];
}

export function extractImports(content: string, filePath: string): ImportDependency[] {
  const imports: ImportDependency[] = [];
  const lines = content.split('\n');

  const patterns = [
    /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line) continue;

    for (const pattern of patterns) {
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(line)) !== null) {
        const importPath = match[1];
        if (!importPath || !importPath.startsWith('.')) continue;

        const sourceDir = path.dirname(filePath);
        let resolvedPath = path.normalize(path.join(sourceDir, importPath));

        resolvedPath = resolveTypescriptPath(resolvedPath);

        imports.push({
          sourceFile: filePath,
          importPath,
          resolvedPath,
          line: lineNum + 1,
        });
      }
    }
  }

  return imports;
}

export function extractAllImports(directory: string, projectRoot: string): ImportDependency[] {
  const allImports: ImportDependency[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        walkDir(fullPath);
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const imports = extractImports(content, relativePath);
          allImports.push(...imports);
        } catch {
          continue;
        }
      }
    }
  }

  walkDir(directory);
  return allImports;
}

export function filterExternalDependencies(imports: ImportDependency[]): ImportDependency[] {
  return imports.filter((imp) => {
    const normalized = imp.resolvedPath.replace(/\\/g, '/');
    return !normalized.startsWith('scripts/');
  });
}

export function parseSparseCheckoutConfig(workflowPath: string): SparseCheckoutConfig {
  const content = fs.readFileSync(workflowPath, 'utf-8');

  const sparseCheckoutMatch = content.match(/sparse-checkout:\s*\|\s*\n((?:\s+[^\n]+\n?)+)/);
  if (!sparseCheckoutMatch || !sparseCheckoutMatch[1]) {
    return { paths: [], workflowFile: workflowPath };
  }

  const paths = sparseCheckoutMatch[1]
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  return { paths, workflowFile: workflowPath };
}

export function isPathIncluded(filePath: string, sparseConfig: SparseCheckoutConfig): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const configPath of sparseConfig.paths) {
    const normalizedConfigPath = configPath.replace(/\\/g, '/');

    if (normalizedPath === normalizedConfigPath) return true;
    if (normalizedPath.startsWith(normalizedConfigPath + '/')) return true;
    if (normalizedConfigPath.endsWith('/') && normalizedPath.startsWith(normalizedConfigPath)) return true;
  }

  return false;
}

export function validateSparseCheckout(projectRoot: string): ValidationResult {
  const errors: string[] = [];
  const results: CheckResult[] = [];

  const scriptsDir = path.join(projectRoot, 'scripts');
  if (!fs.existsSync(scriptsDir)) {
    return {
      success: false,
      totalImports: 0,
      externalDependencies: 0,
      missingDependencies: 0,
      results: [],
      errors: ['scripts/ directory not found'],
    };
  }

  const allImports = extractAllImports(scriptsDir, projectRoot);
  const externalDeps = filterExternalDependencies(allImports);

  const workflowPath = path.join(projectRoot, '.github/workflows/analysis-engine.yml');
  let sparseConfig: SparseCheckoutConfig;

  try {
    sparseConfig = parseSparseCheckoutConfig(workflowPath);
  } catch (err) {
    return {
      success: false,
      totalImports: allImports.length,
      externalDependencies: externalDeps.length,
      missingDependencies: 0,
      results: [],
      errors: [`Failed to parse workflow file: ${err}`],
    };
  }

  let missingCount = 0;

  for (const dep of externalDeps) {
    const actualPath = resolveTypescriptPath(dep.resolvedPath, projectRoot);
    const updatedDep = { ...dep, resolvedPath: actualPath };

    const isIncluded = isPathIncluded(actualPath, sparseConfig);
    const fullPath = path.join(projectRoot, actualPath);
    const fileExists = fs.existsSync(fullPath);

    if (!fileExists) {
      results.push({
        status: 'error',
        dependency: updatedDep,
        includedInSparseCheckout: isIncluded,
        message: `File does not exist: ${actualPath}`,
      });
      errors.push(`File not found: ${actualPath} (imported from ${dep.sourceFile}:${dep.line})`);
      missingCount++;
    } else if (!isIncluded) {
      results.push({
        status: 'missing',
        dependency: updatedDep,
        includedInSparseCheckout: false,
        message: `Add "${path.dirname(actualPath)}" to sparse-checkout`,
      });
      missingCount++;
    } else {
      results.push({
        status: 'ok',
        dependency: updatedDep,
        includedInSparseCheckout: true,
      });
    }
  }

  return {
    success: missingCount === 0 && errors.length === 0,
    totalImports: allImports.length,
    externalDependencies: externalDeps.length,
    missingDependencies: missingCount,
    results,
    errors,
  };
}

function formatValidationResult(result: ValidationResult): void {
  console.log('\n🔍 Sparse Checkout Dependency Check\n');
  console.log('━'.repeat(70));

  console.log(`\n📊 Summary:`);
  console.log(`   Total imports in scripts/: ${result.totalImports}`);
  console.log(`   External dependencies: ${result.externalDependencies}`);
  console.log(`   Missing in sparse-checkout: ${result.missingDependencies}`);

  if (result.results.length > 0) {
    console.log('\n📁 External Dependencies:\n');

    const missingResults = result.results.filter((r) => r.status !== 'ok');
    const okResults = result.results.filter((r) => r.status === 'ok');

    for (const r of missingResults) {
      const icon = r.status === 'missing' ? '❌' : '⚠️';
      console.log(`   ${icon} ${r.dependency.resolvedPath}`);
      console.log(`      ├─ Imported from: ${r.dependency.sourceFile}:${r.dependency.line}`);
      console.log(`      ├─ Import path: ${r.dependency.importPath}`);
      console.log(`      └─ ${r.message}`);
      console.log('');
    }

    if (okResults.length > 0) {
      console.log('   ✅ Properly configured:');
      for (const r of okResults) {
        console.log(`      • ${r.dependency.resolvedPath}`);
      }
    }
  }

  console.log('\n' + '━'.repeat(70));

  if (!result.success) {
    console.log('\n❌ Sparse checkout configuration incomplete!\n');
    console.log('Fix .github/workflows/analysis-engine.yml:\n');
    console.log('  sparse-checkout: |');

    const missingPaths = new Set<string>();
    for (const r of result.results) {
      if (r.status === 'missing') {
        missingPaths.add(path.dirname(r.dependency.resolvedPath).replace(/\\/g, '/'));
      }
    }

    console.log('    scripts');
    for (const p of missingPaths) {
      console.log(`    ${p}  # <-- ADD THIS`);
    }
    console.log('\n⚠️  Without this, consumer repos get ERR_MODULE_NOT_FOUND\n');
    process.exit(1);
  } else {
    console.log('\n✅ All external dependencies included in sparse-checkout!\n');
    process.exit(0);
  }
}

export function runCheck(): ValidationResult {
  const projectRoot = path.resolve(__dirname, '..');
  return validateSparseCheckout(projectRoot);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('sparse-checkout-check.ts')) {
  const result = runCheck();
  formatValidationResult(result);
}
