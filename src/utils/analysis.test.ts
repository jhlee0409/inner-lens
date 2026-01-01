import { describe, it, expect } from 'vitest';
import {
  extractErrorLocations,
  extractErrorMessages,
  parseImports,
  extractKeywords,
  extractCodeChunks,
  scoreChunk,
  type CodeChunk,
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
      expect(locations[0]?.functionName).toBeUndefined();
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

// ============================================
// Code Chunking Tests (P3-1)
// ============================================

describe('extractCodeChunks', () => {
  describe('function extraction', () => {
    it('extracts regular function declarations', () => {
      const code = `function processData(input) {
  return input.map(x => x * 2);
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'function',
        name: 'processData',
        startLine: 1,
        endLine: 3,
      });
      expect(chunks[0]?.signature).toContain('function processData');
    });

    it('extracts async function declarations', () => {
      const code = `async function fetchData(url) {
  const response = await fetch(url);
  return response.json();
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'function',
        name: 'fetchData',
      });
    });

    it('extracts exported function declarations', () => {
      const code = `export function calculateSum(a, b) {
  return a + b;
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'function',
        name: 'calculateSum',
      });
      expect(chunks[0]?.signature).toContain('export');
    });

    it('extracts arrow functions assigned to const', () => {
      const code = `const handleClick = (event) => {
  console.log(event);
  doSomething();
};`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'function',
        name: 'handleClick',
      });
    });

    it('extracts async arrow functions', () => {
      const code = `export const loadData = async (id) => {
  const result = await api.get(id);
  return result;
};`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'function',
        name: 'loadData',
      });
    });
  });

  describe('class extraction', () => {
    it('extracts class declarations', () => {
      const code = `class UserService {
  constructor(db) {
    this.db = db;
  }

  async getUser(id) {
    return this.db.find(id);
  }
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'class',
        name: 'UserService',
        startLine: 1,
      });
    });

    it('extracts exported class declarations', () => {
      const code = `export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'class',
        name: 'ApiClient',
      });
      expect(chunks[0]?.signature).toContain('export');
    });
  });

  describe('interface extraction', () => {
    it('extracts interface declarations', () => {
      const code = `interface UserData {
  id: number;
  name: string;
  email: string;
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'interface',
        name: 'UserData',
      });
    });

    it('extracts exported interface declarations', () => {
      const code = `export interface Config {
  apiUrl: string;
  timeout: number;
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'interface',
        name: 'Config',
      });
    });
  });

  describe('type extraction', () => {
    it('extracts type alias declarations', () => {
      const code = `type UserId = string | number;`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'type',
        name: 'UserId',
      });
    });

    it('extracts exported type alias declarations', () => {
      const code = `export type UserId = string | number;`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'type',
        name: 'UserId',
      });
      expect(chunks[0]?.signature).toContain('export');
    });

    it('extracts object type declarations', () => {
      const code = `type Config = {
  apiUrl: string;
  timeout: number;
};`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        type: 'type',
        name: 'Config',
      });
    });
  });

  describe('multiple chunks', () => {
    it('extracts multiple declarations from same file', () => {
      const code = `interface User {
  id: number;
  name: string;
}

function createUser(name: string): User {
  return { id: Date.now(), name };
}

class UserRepository {
  private users: User[] = [];

  add(user: User) {
    this.users.push(user);
  }
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(3);
      expect(chunks.map(c => c.type)).toContain('interface');
      expect(chunks.map(c => c.type)).toContain('function');
      expect(chunks.map(c => c.type)).toContain('class');
    });

    it('correctly identifies line ranges for each chunk', () => {
      const code = `function first() {
  return 1;
}

function second() {
  return 2;
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toMatchObject({
        name: 'first',
        startLine: 1,
        endLine: 3,
      });
      expect(chunks[1]).toMatchObject({
        name: 'second',
        startLine: 5,
        endLine: 7,
      });
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty content', () => {
      const chunks = extractCodeChunks('');
      expect(chunks).toHaveLength(0);
    });

    it('returns empty array for content without functions', () => {
      const code = `// Just a comment
const x = 5;
let y = 10;`;

      const chunks = extractCodeChunks(code);
      expect(chunks).toHaveLength(0);
    });

    it('ignores commented code', () => {
      const code = `// function ignored() { return 1; }
function actual() {
  return 2;
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.name).toBe('actual');
    });

    it('handles nested braces correctly', () => {
      const code = `function complex() {
  if (true) {
    const obj = { a: 1, b: { c: 2 } };
    return obj;
  }
}`;

      const chunks = extractCodeChunks(code);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({
        name: 'complex',
        startLine: 1,
        endLine: 6,
      });
    });
  });
});

describe('scoreChunk', () => {
  const createChunk = (overrides: Partial<CodeChunk> = {}): CodeChunk => ({
    type: 'function',
    name: 'testFunction',
    startLine: 1,
    endLine: 10,
    content: 'function testFunction() {}',
    signature: 'function testFunction()',
    ...overrides,
  });

  it('scores 100 points for error location match within chunk', () => {
    const chunk = createChunk({ startLine: 5, endLine: 15 });
    const errorLocations = [{ file: 'test.ts', line: 10 }];

    const score = scoreChunk(chunk, errorLocations, []);

    expect(score).toBe(100);
  });

  it('scores 50 points for function name match', () => {
    const chunk = createChunk({ name: 'handleSubmit' });
    const errorLocations = [{ file: 'test.ts', functionName: 'handleSubmit' }];

    const score = scoreChunk(chunk, errorLocations, []);

    expect(score).toBe(50);
  });

  it('scores 10 points for keyword match', () => {
    const chunk = createChunk({ name: 'processUser', signature: 'function processUser()' });

    const score = scoreChunk(chunk, [], ['user']);

    expect(score).toBe(10);
  });

  it('scores 5 points for exported function', () => {
    const chunk = createChunk({ signature: 'export function test()' });

    const score = scoreChunk(chunk, [], []);

    expect(score).toBe(5);
  });

  it('combines multiple score sources', () => {
    const chunk = createChunk({
      name: 'handleError',
      startLine: 10,
      endLine: 20,
      signature: 'export function handleError()',
    });
    const errorLocations = [
      { file: 'test.ts', line: 15, functionName: 'handleError' },
    ];

    const score = scoreChunk(chunk, errorLocations, ['error', 'handle']);

    // 100 (line match) + 50 (function name) + 10 (error keyword) + 10 (handle keyword) + 5 (export)
    expect(score).toBe(175);
  });

  it('returns 0 for no matches', () => {
    const chunk = createChunk({ name: 'unrelated', signature: 'function unrelated()' });

    const score = scoreChunk(chunk, [], []);

    expect(score).toBe(0);
  });

  it('ignores short keywords', () => {
    const chunk = createChunk({ name: 'abc', signature: 'function abc()' });

    const score = scoreChunk(chunk, [], ['ab', 'a', 'bc']);

    expect(score).toBe(0); // Short keywords (<=2 chars) should be ignored
  });
});
