import { describe, it, expect } from 'vitest';
import { extractCodeChunks, extractCodeChunksAsync } from './code-chunking';

describe('extractCodeChunks (regex fallback)', () => {
  it('should extract function declarations', () => {
    const code = `
function hello() {
  return 'world';
}
`;
    const chunks = extractCodeChunks(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('function');
    expect(chunks[0].name).toBe('hello');
  });

  it('should extract class declarations', () => {
    const code = `
export class MyClass {
  constructor() {}
  method() {}
}
`;
    const chunks = extractCodeChunks(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('class');
    expect(chunks[0].name).toBe('MyClass');
  });

  it('should extract const arrays', () => {
    const code = `
const ITEMS = [
  'a',
  'b',
  'c',
];
`;
    const chunks = extractCodeChunks(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('const');
    expect(chunks[0].name).toBe('ITEMS');
    expect(chunks[0].startLine).toBe(2);
    expect(chunks[0].endLine).toBe(6);
  });

  it('should extract interface declarations', () => {
    const code = `
export interface User {
  name: string;
  age: number;
}
`;
    const chunks = extractCodeChunks(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('interface');
    expect(chunks[0].name).toBe('User');
  });

  it('should extract type aliases', () => {
    const code = `
type Status = 'active' | 'inactive';
`;
    const chunks = extractCodeChunks(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('type');
    expect(chunks[0].name).toBe('Status');
  });
});

describe('extractCodeChunksAsync (tree-sitter AST)', () => {
  it('should extract function declarations', async () => {
    const code = `
function hello() {
  return 'world';
}
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('function');
    expect(chunks[0].name).toBe('hello');
  });

  it('should extract const arrays with full content', async () => {
    const code = `
const ITEMS = [
  'a',
  'b',
  'c',
];
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('const');
    expect(chunks[0].name).toBe('ITEMS');
    expect(chunks[0].endLine).toBeGreaterThanOrEqual(6);
  });

  it('should handle brackets inside regex literals correctly', async () => {
    const code = `
const PATTERNS = [
  {
    name: 'test',
    pattern: /https:\\/\\/[\\w-]+/gi,
    replacement: '[REDACTED]',
  },
];
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].name).toBe('PATTERNS');
    expect(chunks[0].endLine).toBeGreaterThanOrEqual(7);
    expect(chunks[0].content).toContain('replacement');
  });

  it('should handle brackets inside string literals correctly', async () => {
    const code = `
const CONFIG = {
  message: "[INFO] Starting...",
  pattern: "arr[0]",
  braces: "{}",
};
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].name).toBe('CONFIG');
    expect(chunks[0].endLine).toBeGreaterThanOrEqual(5);
    expect(chunks[0].content).toContain('braces');
  });

  it('should handle complex masking patterns array', async () => {
    const code = `
const MASKING_PATTERNS: MaskingPattern[] = [
  {
    name: 'discord_webhook',
    pattern: /https:\\/\\/(?:ptb\\.|canary\\.)?discord(?:app)?\\.com\\/api\\/webhooks\\/\\d+\\/[\\w-]+/gi,
    replacement: '[DISCORD_WEBHOOK_REDACTED]',
  },
  {
    name: 'slack_token',
    pattern: /xox[baprs]-[\\w-]+/gi,
    replacement: '[SLACK_TOKEN_REDACTED]',
  },
];

function test() {
  return MASKING_PATTERNS;
}
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    
    const patternsChunk = chunks.find(c => c.name === 'MASKING_PATTERNS');
    expect(patternsChunk).toBeDefined();
    expect(patternsChunk!.endLine).toBeGreaterThanOrEqual(12);
    expect(patternsChunk!.content).toContain('slack_token');
    
    const testChunk = chunks.find(c => c.name === 'test');
    expect(testChunk).toBeDefined();
  });

  it('should handle arrow functions', async () => {
    const code = `
export const handler = async (req: Request) => {
  return new Response('OK');
};
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('const');
    expect(chunks[0].name).toBe('handler');
  });

  it('should handle exported declarations', async () => {
    const code = `
export function publicFn() {}
export class PublicClass {}
export interface PublicInterface {}
export type PublicType = string;
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(4);
    expect(chunks.map(c => c.name)).toContain('publicFn');
    expect(chunks.map(c => c.name)).toContain('PublicClass');
    expect(chunks.map(c => c.name)).toContain('PublicInterface');
    expect(chunks.map(c => c.name)).toContain('PublicType');
  });

  it('should skip simple const declarations without interesting values', async () => {
    const code = `
const SIMPLE_VALUE = 42;
const ANOTHER_VALUE = "string";
const INTERESTING_ARRAY = [1, 2, 3];
const INTERESTING_OBJECT = { key: 'value' };
`;
    const chunks = await extractCodeChunksAsync(code);
    const names = chunks.map(c => c.name);
    expect(names).toContain('INTERESTING_ARRAY');
    expect(names).toContain('INTERESTING_OBJECT');
  });
});

describe('edge cases', () => {
  it('should handle empty content', async () => {
    const chunks = await extractCodeChunksAsync('');
    expect(chunks).toHaveLength(0);
  });

  it('should handle content with only comments', async () => {
    const code = `
// This is a comment
/* Multi-line
   comment */
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(0);
  });

  it('should handle nested brackets in template literals', async () => {
    const code = `
const createMessage = (items: string[]) => {
  return \`
    Value: \${items[0]}
    Count: \${items.length}
  \`;
};
`;
    const chunks = await extractCodeChunksAsync(code);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].name).toBe('createMessage');
  });
});
