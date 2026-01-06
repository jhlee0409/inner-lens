import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  extractImports,
  extractAllImports,
  filterExternalDependencies,
  parseSparseCheckoutConfig,
  isPathIncluded,
  validateSparseCheckout,
  type ImportDependency,
  type SparseCheckoutConfig,
} from './sparse-checkout-check';

describe('extractImports', () => {
  it('extracts ESM named imports', () => {
    const content = `import { foo, bar } from '../src/utils/helper.js';`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sourceFile: 'scripts/test.ts',
      importPath: '../src/utils/helper.js',
      resolvedPath: 'src/utils/helper.ts',
      line: 1,
    });
  });

  it('extracts default imports', () => {
    const content = `import helper from '../src/utils/helper.js';`;
    const result = extractImports(content, 'scripts/analyzer.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/helper.ts');
  });

  it('extracts namespace imports', () => {
    const content = `import * as utils from '../src/utils/index.js';`;
    const result = extractImports(content, 'scripts/main.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/index.ts');
  });

  it('extracts re-exports', () => {
    const content = `export { maskSensitiveData } from '../src/utils/masking.js';`;
    const result = extractImports(content, 'scripts/analyze.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/masking.ts');
  });

  it('extracts side-effect imports', () => {
    const content = `import '../src/polyfills.js';`;
    const result = extractImports(content, 'scripts/setup.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/polyfills.ts');
  });

  it('ignores node_modules imports', () => {
    const content = `
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import path from 'path';
import { foo } from '../src/utils.js';
`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.importPath).toBe('../src/utils.js');
  });

  it('handles multiple imports per line', () => {
    const content = `import { a } from './lib/a.js'; import { b } from '../src/b.js';`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(2);
  });

  it('handles imports without extension', () => {
    const content = `import { helper } from '../src/utils/helper';`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/helper.ts');
  });

  it('extracts dynamic imports', () => {
    const content = `const module = await import('../src/utils/helper.js');`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/helper.ts');
  });

  it('handles .jsx and .mjs extensions', () => {
    const content = `
import Component from '../src/components/Button.jsx';
import { util } from '../src/utils/helper.mjs';
`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result).toHaveLength(2);
    expect(result[0]?.resolvedPath).toBe('src/components/Button.tsx');
    expect(result[1]?.resolvedPath).toBe('src/utils/helper.mts');
  });

  it('returns correct line numbers', () => {
    const content = `
// line 1 comment
import { a } from './lib/a.js';
// line 3 comment
import { b } from '../src/b.js';
`;
    const result = extractImports(content, 'scripts/test.ts');

    expect(result[0]?.line).toBe(3);
    expect(result[1]?.line).toBe(5);
  });
});

describe('filterExternalDependencies', () => {
  const createDep = (resolvedPath: string): ImportDependency => ({
    sourceFile: 'scripts/test.ts',
    importPath: resolvedPath,
    resolvedPath,
    line: 1,
  });

  it('filters out scripts/ internal dependencies', () => {
    const imports = [
      createDep('scripts/lib/helper.ts'),
      createDep('scripts/agents/finder.ts'),
      createDep('src/utils/masking.ts'),
    ];

    const result = filterExternalDependencies(imports);

    expect(result).toHaveLength(1);
    expect(result[0]?.resolvedPath).toBe('src/utils/masking.ts');
  });

  it('keeps all external dependencies', () => {
    const imports = [
      createDep('src/types.ts'),
      createDep('src/utils/masking.ts'),
      createDep('api/_shared.ts'),
    ];

    const result = filterExternalDependencies(imports);

    expect(result).toHaveLength(3);
  });

  it('returns empty for scripts-only imports', () => {
    const imports = [
      createDep('scripts/lib/a.ts'),
      createDep('scripts/lib/b.ts'),
    ];

    const result = filterExternalDependencies(imports);

    expect(result).toHaveLength(0);
  });
});

describe('parseSparseCheckoutConfig', () => {
  const testWorkflowDir = path.join(__dirname, '__test_fixtures__');
  const testWorkflowPath = path.join(testWorkflowDir, 'test-workflow.yml');

  beforeEach(() => {
    fs.mkdirSync(testWorkflowDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testWorkflowDir, { recursive: true, force: true });
  });

  it('parses sparse-checkout paths from workflow', () => {
    const content = `
name: Test
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: |
            scripts
            src/utils
`;
    fs.writeFileSync(testWorkflowPath, content);

    const result = parseSparseCheckoutConfig(testWorkflowPath);

    expect(result.paths).toEqual(['scripts', 'src/utils']);
  });

  it('handles single path', () => {
    const content = `
name: Test
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: |
            scripts
`;
    fs.writeFileSync(testWorkflowPath, content);

    const result = parseSparseCheckoutConfig(testWorkflowPath);

    expect(result.paths).toEqual(['scripts']);
  });

  it('returns empty paths if no sparse-checkout found', () => {
    const content = `
name: Test
jobs:
  build:
    steps:
      - uses: actions/checkout@v4
`;
    fs.writeFileSync(testWorkflowPath, content);

    const result = parseSparseCheckoutConfig(testWorkflowPath);

    expect(result.paths).toEqual([]);
  });
});

describe('isPathIncluded', () => {
  const config: SparseCheckoutConfig = {
    paths: ['scripts', 'src/utils'],
    workflowFile: 'test.yml',
  };

  it('matches exact path', () => {
    expect(isPathIncluded('scripts', config)).toBe(true);
    expect(isPathIncluded('src/utils', config)).toBe(true);
  });

  it('matches files under included directory', () => {
    expect(isPathIncluded('scripts/analyze.ts', config)).toBe(true);
    expect(isPathIncluded('src/utils/masking.ts', config)).toBe(true);
    expect(isPathIncluded('src/utils/deep/nested/file.ts', config)).toBe(true);
  });

  it('rejects files outside included directories', () => {
    expect(isPathIncluded('src/types.ts', config)).toBe(false);
    expect(isPathIncluded('src/core/InnerLensCore.ts', config)).toBe(false);
    expect(isPathIncluded('api/_shared.ts', config)).toBe(false);
  });

  it('handles Windows-style paths', () => {
    expect(isPathIncluded('scripts\\lib\\helper.ts', config)).toBe(true);
    expect(isPathIncluded('src\\utils\\masking.ts', config)).toBe(true);
  });
});

describe('validateSparseCheckout (integration)', () => {
  it('validates actual project configuration', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const result = validateSparseCheckout(projectRoot);

    expect(result.totalImports).toBeGreaterThan(0);

    if (!result.success) {
      console.log('\n⚠️ Sparse checkout validation failed:');
      for (const r of result.results.filter((x) => x.status !== 'ok')) {
        console.log(`   - ${r.dependency.resolvedPath}: ${r.message}`);
      }
    }

    expect(result.success).toBe(true);
  });

  it('detects external dependencies correctly', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const result = validateSparseCheckout(projectRoot);

    const externalPaths = result.results.map((r) => r.dependency.resolvedPath);

    expect(externalPaths.some((p) => p.includes('src/'))).toBe(true);
  });
});

describe('regression: ERR_MODULE_NOT_FOUND prevention', () => {
  it('ensures src/utils/masking.ts is in sparse-checkout when imported', () => {
    const projectRoot = path.resolve(__dirname, '..');
    const result = validateSparseCheckout(projectRoot);

    const maskingDep = result.results.find((r) =>
      r.dependency.resolvedPath.includes('masking')
    );

    if (maskingDep) {
      expect(maskingDep.includedInSparseCheckout).toBe(true);
      expect(maskingDep.status).toBe('ok');
    }
  });

  it('fails fast when new external dependency is added without sparse-checkout update', () => {
    const content = `import { foo } from '../src/new-module.js';`;
    const imports = extractImports(content, 'scripts/test.ts');

    expect(imports).toHaveLength(1);
    expect(imports[0]?.resolvedPath).toBe('src/new-module.ts');

    const config: SparseCheckoutConfig = {
      paths: ['scripts', 'src/utils'],
      workflowFile: 'test.yml',
    };

    expect(isPathIncluded('src/new-module.ts', config)).toBe(false);
  });
});
