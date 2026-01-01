import { describe, it, expect } from 'vitest';
import {
  extractErrorLocations,
  extractErrorMessages,
  parseImports,
  extractKeywords,
  extractCodeChunks,
  scoreChunk,
  extractFunctionCalls,
  buildCallGraph,
  findCallChain,
  getRelatedFunctions,
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

// ============================================
// Call Graph Tests (P4-2)
// ============================================

describe('extractFunctionCalls', () => {
  it('extracts direct function calls', () => {
    const code = `function main() {
  const result = processData();
  return result;
}`;

    const calls = extractFunctionCalls(code, 'main', 1);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      caller: 'main',
      callee: 'processData',
      line: 2,
    });
  });

  it('extracts multiple function calls', () => {
    const code = `function handler() {
  validateInput();
  const data = fetchData();
  processData(data);
  saveResult();
}`;

    const calls = extractFunctionCalls(code, 'handler', 1);

    expect(calls).toHaveLength(4);
    expect(calls.map(c => c.callee)).toEqual([
      'validateInput',
      'fetchData',
      'processData',
      'saveResult',
    ]);
  });

  it('detects async calls with await', () => {
    const code = `async function loadUser() {
  const user = await fetchUser();
  return user;
}`;

    const calls = extractFunctionCalls(code, 'loadUser', 1);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      callee: 'fetchUser',
      isAsync: true,
    });
  });

  it('ignores built-in functions', () => {
    const code = `function process() {
  console.log('test');
  const x = parseInt('5');
  return JSON.stringify({});
}`;

    const calls = extractFunctionCalls(code, 'process', 1);

    expect(calls).toHaveLength(0);
  });

  it('ignores control flow keywords', () => {
    const code = `function check() {
  if (condition) {
    for (let i = 0; i < 10; i++) {
      while (true) {
        break;
      }
    }
  }
}`;

    const calls = extractFunctionCalls(code, 'check', 1);

    expect(calls).toHaveLength(0);
  });

  it('ignores the caller function itself', () => {
    const code = `function recursive() {
  recursive();
}`;

    const calls = extractFunctionCalls(code, 'recursive', 1);

    // Recursive calls are currently filtered out
    expect(calls).toHaveLength(0);
  });

  it('extracts calls with arguments', () => {
    const code = `function calculate() {
  add(1, 2);
  multiply(a, b, c);
}`;

    const calls = extractFunctionCalls(code, 'calculate', 1);

    expect(calls).toHaveLength(2);
    expect(calls.map(c => c.callee)).toEqual(['add', 'multiply']);
  });
});

describe('buildCallGraph', () => {
  it('builds graph from chunks with call relationships', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'main',
        startLine: 1,
        endLine: 5,
        content: `function main() {
  helper();
  process();
}`,
        signature: 'export function main()',
      },
      {
        type: 'function',
        name: 'helper',
        startLine: 7,
        endLine: 10,
        content: `function helper() {
  return 42;
}`,
        signature: 'function helper()',
      },
      {
        type: 'function',
        name: 'process',
        startLine: 12,
        endLine: 15,
        content: `function process() {
  helper();
}`,
        signature: 'function process()',
      },
    ];

    const graph = buildCallGraph(chunks);

    expect(graph.size).toBe(3);

    // main calls helper and process
    const mainNode = graph.get('main');
    expect(mainNode?.calls).toContain('helper');
    expect(mainNode?.calls).toContain('process');
    expect(mainNode?.isExported).toBe(true);

    // helper is called by main and process
    const helperNode = graph.get('helper');
    expect(helperNode?.calledBy).toContain('main');
    expect(helperNode?.calledBy).toContain('process');

    // process calls helper
    const processNode = graph.get('process');
    expect(processNode?.calls).toContain('helper');
  });

  it('handles isolated functions with no calls', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'standalone',
        startLine: 1,
        endLine: 3,
        content: 'function standalone() { return 1; }',
        signature: 'function standalone()',
      },
    ];

    const graph = buildCallGraph(chunks);

    expect(graph.size).toBe(1);
    const node = graph.get('standalone');
    expect(node?.calls).toHaveLength(0);
    expect(node?.calledBy).toHaveLength(0);
  });

  it('only includes known functions in the graph', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'caller',
        startLine: 1,
        endLine: 4,
        content: `function caller() {
  unknownFunction();
  knownFunction();
}`,
        signature: 'function caller()',
      },
      {
        type: 'function',
        name: 'knownFunction',
        startLine: 6,
        endLine: 8,
        content: 'function knownFunction() {}',
        signature: 'function knownFunction()',
      },
    ];

    const graph = buildCallGraph(chunks);

    const callerNode = graph.get('caller');
    expect(callerNode?.calls).toContain('knownFunction');
    expect(callerNode?.calls).not.toContain('unknownFunction');
  });
});

describe('findCallChain', () => {
  it('finds path from error function to entry point', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'handleRequest',
        startLine: 1,
        endLine: 5,
        content: `export function handleRequest() {
  processInput();
}`,
        signature: 'export function handleRequest()',
      },
      {
        type: 'function',
        name: 'processInput',
        startLine: 7,
        endLine: 11,
        content: `function processInput() {
  validateData();
}`,
        signature: 'function processInput()',
      },
      {
        type: 'function',
        name: 'validateData',
        startLine: 13,
        endLine: 17,
        content: `function validateData() {
  // Error occurs here
}`,
        signature: 'function validateData()',
      },
    ];

    const graph = buildCallGraph(chunks);
    const chains = findCallChain(graph, 'validateData');

    expect(chains).toHaveLength(1);
    expect(chains[0]).toEqual(['handleRequest', 'processInput', 'validateData']);
  });

  it('returns empty array when no entry point found', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'internal',
        startLine: 1,
        endLine: 3,
        content: 'function internal() {}',
        signature: 'function internal()',
      },
    ];

    const graph = buildCallGraph(chunks);
    const chains = findCallChain(graph, 'internal');

    expect(chains).toHaveLength(0);
  });

  it('respects maxDepth parameter', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'a',
        startLine: 1,
        endLine: 2,
        content: 'export function a() { b(); }',
        signature: 'export function a()',
      },
      {
        type: 'function',
        name: 'b',
        startLine: 3,
        endLine: 4,
        content: 'function b() { c(); }',
        signature: 'function b()',
      },
      {
        type: 'function',
        name: 'c',
        startLine: 5,
        endLine: 6,
        content: 'function c() { d(); }',
        signature: 'function c()',
      },
      {
        type: 'function',
        name: 'd',
        startLine: 7,
        endLine: 8,
        content: 'function d() {}',
        signature: 'function d()',
      },
    ];

    const graph = buildCallGraph(chunks);

    // With maxDepth 2, should not find chain a->b->c->d
    const shortChains = findCallChain(graph, 'd', 2);
    expect(shortChains).toHaveLength(0);

    // With maxDepth 5, should find the full chain
    const longChains = findCallChain(graph, 'd', 5);
    expect(longChains).toHaveLength(1);
  });
});

describe('getRelatedFunctions', () => {
  it('returns connected functions in the call graph', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'entryPoint',
        startLine: 1,
        endLine: 3,
        content: 'export function entryPoint() { middle(); }',
        signature: 'export function entryPoint()',
      },
      {
        type: 'function',
        name: 'middle',
        startLine: 5,
        endLine: 7,
        content: 'function middle() { leaf(); }',
        signature: 'function middle()',
      },
      {
        type: 'function',
        name: 'leaf',
        startLine: 9,
        endLine: 11,
        content: 'function leaf() {}',
        signature: 'function leaf()',
      },
      {
        type: 'function',
        name: 'isolated',
        startLine: 13,
        endLine: 15,
        content: 'function isolated() {}',
        signature: 'function isolated()',
      },
    ];

    const graph = buildCallGraph(chunks);
    const related = getRelatedFunctions(graph, 'middle');

    expect(related).toHaveLength(3); // middle, entryPoint, leaf
    expect(related.map(n => n.name)).toContain('middle');
    expect(related.map(n => n.name)).toContain('entryPoint');
    expect(related.map(n => n.name)).toContain('leaf');
    expect(related.map(n => n.name)).not.toContain('isolated');
  });

  it('respects maxRelated limit', () => {
    const chunks: CodeChunk[] = [
      {
        type: 'function',
        name: 'a',
        startLine: 1,
        endLine: 2,
        content: 'function a() { b(); c(); d(); e(); }',
        signature: 'function a()',
      },
      {
        type: 'function',
        name: 'b',
        startLine: 3,
        endLine: 4,
        content: 'function b() {}',
        signature: 'function b()',
      },
      {
        type: 'function',
        name: 'c',
        startLine: 5,
        endLine: 6,
        content: 'function c() {}',
        signature: 'function c()',
      },
      {
        type: 'function',
        name: 'd',
        startLine: 7,
        endLine: 8,
        content: 'function d() {}',
        signature: 'function d()',
      },
      {
        type: 'function',
        name: 'e',
        startLine: 9,
        endLine: 10,
        content: 'function e() {}',
        signature: 'function e()',
      },
    ];

    const graph = buildCallGraph(chunks);
    const related = getRelatedFunctions(graph, 'a', 2);

    expect(related).toHaveLength(2);
  });
});
