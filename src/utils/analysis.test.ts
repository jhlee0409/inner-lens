import { describe, it, expect } from 'vitest';
import {
  extractErrorLocations,
  extractErrorMessages,
  parseImports,
  extractKeywords,
} from './analysis';

describe('extractErrorLocations', () => {
  describe('Node.js/Chrome stack traces', () => {
    it('parses standard Node.js stack trace', () => {
      const stackTrace = `Error: Something went wrong
    at processFile (/app/src/utils/parser.ts:42:15)
    at main (/app/src/index.ts:10:3)`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        file: 'parser.ts',
        line: 42,
        column: 15,
        functionName: 'processFile',
      });
      expect(locations[1]).toMatchObject({
        file: 'index.ts',
        line: 10,
        column: 3,
        functionName: 'main',
      });
    });

    it('parses Chrome browser stack trace with URLs', () => {
      const stackTrace = `TypeError: Cannot read property 'map' of undefined
    at renderList (http://localhost:3000/static/js/main.chunk.js:1234:56)
    at Component (http://localhost:3000/src/components/List.tsx:25:10)`;

      const locations = extractErrorLocations(stackTrace);

      // Should find at least 2 locations (may find more due to multiple patterns)
      expect(locations.length).toBeGreaterThanOrEqual(2);
      // Check that the expected files are found
      expect(locations.some(l => l.file === 'main.chunk.js' && l.line === 1234)).toBe(true);
      expect(locations.some(l => l.file === 'List.tsx' && l.line === 25)).toBe(true);
    });

    it('parses anonymous function stack trace', () => {
      const stackTrace = `Error: Failed
    at /app/src/handler.js:10:5`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({
        file: 'handler.js',
        line: 10,
        column: 5,
      });
      expect(locations[0].functionName).toBeUndefined();
    });
  });

  describe('Firefox stack traces', () => {
    it('parses Firefox-style stack trace', () => {
      const stackTrace = `handleClick@app.js:25:10
processEvent@utils.js:100:5`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        file: 'app.js',
        line: 25,
        column: 10,
        functionName: 'handleClick',
      });
      expect(locations[1]).toMatchObject({
        file: 'utils.js',
        line: 100,
        column: 5,
        functionName: 'processEvent',
      });
    });
  });

  describe('Python stack traces', () => {
    it('parses Python stack trace', () => {
      const stackTrace = `Traceback (most recent call last):
  File "/app/main.py", line 50, in main
    process_data(data)
  File "/app/utils/parser.py", line 25, in process_data
    raise ValueError("Invalid data")`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        file: 'main.py',
        line: 50,
        functionName: 'main',
      });
      expect(locations[1]).toMatchObject({
        file: 'parser.py',
        line: 25,
        functionName: 'process_data',
      });
    });

    it('parses Python stack trace without function name', () => {
      const stackTrace = `File "/app/script.py", line 10`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({
        file: 'script.py',
        line: 10,
      });
    });
  });

  describe('Generic file:line patterns', () => {
    it('parses simple file:line references', () => {
      const text = `Error occurred in src/utils/helper.ts:42`;

      const locations = extractErrorLocations(text);

      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({
        file: 'helper.ts',
        line: 42,
      });
    });

    it('parses file:line:column references', () => {
      const text = `See component.tsx:15:8 for details`;

      const locations = extractErrorLocations(text);

      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({
        file: 'component.tsx',
        line: 15,
        column: 8,
      });
    });
  });

  describe('Webpack stack traces', () => {
    it('parses webpack source map URLs', () => {
      const stackTrace = `at webpack:///./src/components/Button.tsx:15
at webpack:///./src/App.tsx`;

      const locations = extractErrorLocations(stackTrace);

      expect(locations.length).toBeGreaterThanOrEqual(1);
      expect(locations.some(l => l.file === 'Button.tsx')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for text without stack traces', () => {
      const text = 'This is just regular text without any error information.';
      const locations = extractErrorLocations(text);
      expect(locations).toHaveLength(0);
    });

    it('deduplicates files', () => {
      const stackTrace = `at func1 (/app/file.ts:10:5)
at func2 (/app/file.ts:20:5)`;

      const locations = extractErrorLocations(stackTrace);
      // Should only have one entry for file.ts
      expect(locations).toHaveLength(1);
    });
  });
});

describe('extractErrorMessages', () => {
  it('extracts TypeError messages', () => {
    const text = `TypeError: Cannot read property 'foo' of undefined`;
    const messages = extractErrorMessages(text);

    expect(messages).toContain("Cannot read property 'foo' of undefined");
  });

  it('extracts ReferenceError messages', () => {
    const text = `ReferenceError: myVariable is not defined`;
    const messages = extractErrorMessages(text);

    expect(messages).toContain('myVariable is not defined');
  });

  it('extracts generic Error messages', () => {
    const text = `Error: Something went wrong with the operation`;
    const messages = extractErrorMessages(text);

    expect(messages).toContain('Something went wrong with the operation');
  });

  it('extracts Uncaught Error messages', () => {
    const text = `Uncaught Error: Failed to fetch data`;
    const messages = extractErrorMessages(text);

    expect(messages).toContain('Failed to fetch data');
  });

  it('extracts HTTP status error messages', () => {
    const text = `500 Internal Server Error: Database connection failed`;
    const messages = extractErrorMessages(text);

    expect(messages.some(m => m.includes('Database connection failed'))).toBe(true);
  });

  it('extracts NetworkError messages', () => {
    const text = `NetworkError: Failed to connect to server`;
    const messages = extractErrorMessages(text);

    expect(messages).toContain('Failed to connect to server');
  });

  it('deduplicates messages', () => {
    const text = `Error: duplicate
Error: duplicate
Error: duplicate`;

    const messages = extractErrorMessages(text);
    expect(messages.filter(m => m === 'duplicate')).toHaveLength(1);
  });

  it('filters out short messages', () => {
    const text = `Error: ab`;
    const messages = extractErrorMessages(text);

    expect(messages).toHaveLength(0);
  });
});

describe('parseImports', () => {
  describe('ES6 imports', () => {
    it('parses named imports', () => {
      const code = `import { foo, bar } from './utils';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './utils',
        isRelative: true,
        type: 'import',
      });
    });

    it('parses default imports', () => {
      const code = `import React from 'react';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'react',
        isRelative: false,
        type: 'import',
      });
    });

    it('parses namespace imports', () => {
      const code = `import * as utils from '../lib/utils';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: '../lib/utils',
        isRelative: true,
        type: 'import',
      });
    });

    it('parses mixed imports', () => {
      const code = `import React, { useState } from 'react';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'react',
        isRelative: false,
      });
    });

    it('parses side-effect imports', () => {
      const code = `import './styles.css';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './styles.css',
        isRelative: true,
        type: 'import',
      });
    });
  });

  describe('CommonJS require', () => {
    it('parses require statements', () => {
      const code = `const fs = require('fs');`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'fs',
        isRelative: false,
        type: 'require',
      });
    });

    it('parses relative require', () => {
      const code = `const helper = require('./helper');`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './helper',
        isRelative: true,
        type: 'require',
      });
    });
  });

  describe('dynamic imports', () => {
    it('parses dynamic import expressions', () => {
      const code = `const module = await import('./dynamic-module');`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './dynamic-module',
        isRelative: true,
        type: 'dynamic',
      });
    });
  });

  describe('re-exports', () => {
    it('parses named re-exports', () => {
      const code = `export { foo, bar } from './utils';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './utils',
        isRelative: true,
        type: 'import',
      });
    });

    it('parses star re-exports', () => {
      const code = `export * from './types';`;
      const imports = parseImports(code);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './types',
        isRelative: true,
      });
    });
  });

  describe('edge cases', () => {
    it('deduplicates imports', () => {
      const code = `
import { a } from './utils';
import { b } from './utils';
`;
      const imports = parseImports(code);
      expect(imports).toHaveLength(1);
    });

    it('handles multiple different imports', () => {
      const code = `
import React from 'react';
import { useState } from 'react';
import path from 'path';
import './styles.css';
`;
      const imports = parseImports(code);
      // 'react' is deduplicated, so we get: react, path, ./styles.css
      expect(imports).toHaveLength(3);
    });
  });
});

describe('extractKeywords', () => {
  it('extracts file paths', () => {
    // Pattern matches paths like dir/file.ext
    const text = 'Check the file utils/Button.tsx for issues';
    const keywords = extractKeywords(text);

    expect(keywords).toContain('utils/Button.tsx');
  });

  it('extracts error type names', () => {
    const text = 'Got a TypeError when calling the function';
    const keywords = extractKeywords(text);

    expect(keywords).toContain('TypeError');
  });

  it('extracts PascalCase identifiers', () => {
    const text = 'The UserProfileComponent is not rendering correctly';
    const keywords = extractKeywords(text);

    expect(keywords).toContain('UserProfileComponent');
  });

  it('extracts camelCase identifiers', () => {
    const text = 'The handleSubmit function throws an error';
    const keywords = extractKeywords(text);

    expect(keywords).toContain('handleSubmit');
  });

  it('extracts file names from stack traces', () => {
    const text = `Error at handler.ts:25:10`;
    const keywords = extractKeywords(text);

    expect(keywords.some(k => k.includes('handler.ts'))).toBe(true);
  });

  it('deduplicates keywords', () => {
    const text = 'TypeError TypeError TypeError';
    const keywords = extractKeywords(text);

    expect(keywords.filter(k => k === 'TypeError')).toHaveLength(1);
  });
});
