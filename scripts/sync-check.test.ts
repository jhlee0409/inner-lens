import { describe, it, expect } from 'vitest';
import {
  stripCommentsAndNormalize,
  extractWithBraceBalancing,
  extractMaskingPatternHashes,
  compareMaskingPatterns,
  hashContent,
} from './sync-check';

describe('stripCommentsAndNormalize', () => {
  it('removes JSDoc comments', () => {
    const input = '/** comment */ export interface Foo { x: number; }';
    expect(stripCommentsAndNormalize(input)).toBe(
      'export interface Foo { x: number; }'
    );
  });

  it('removes inline comments', () => {
    const input = 'x: number; // inline comment\ny: string;';
    expect(stripCommentsAndNormalize(input)).toBe('x: number; y: string;');
  });

  it('removes multi-line JSDoc', () => {
    const input = `/**
     * Multi-line comment
     * with multiple lines
     */
    export const FOO = 1;`;
    expect(stripCommentsAndNormalize(input)).toBe('export const FOO = 1;');
  });

  it('normalizes whitespace', () => {
    const input = '  export   interface   Foo  {  }  ';
    expect(stripCommentsAndNormalize(input)).toBe('export interface Foo { }');
  });
});

describe('extractWithBraceBalancing', () => {
  it('extracts simple interface', () => {
    const content = 'export interface Foo { x: number; }';
    const result = extractWithBraceBalancing(
      content,
      /export interface Foo \{/
    );
    expect(result).toBe('export interface Foo { x: number; }');
  });

  it('handles nested objects correctly', () => {
    const content = `export interface Foo {
      nested: {
        x: number;
        deep: { y: string; }
      }
      other: string;
    }`;
    const result = extractWithBraceBalancing(
      content,
      /export interface Foo \{/
    );
    expect(result).toContain('other: string;');
    expect(result).toContain('nested:');
  });

  it('returns null for non-matching pattern', () => {
    const content = 'export interface Bar { x: number; }';
    const result = extractWithBraceBalancing(
      content,
      /export interface Foo \{/
    );
    expect(result).toBeNull();
  });
});

describe('extractMaskingPatternHashes', () => {
  it('extracts pattern objects', () => {
    const content = `const MASKING_PATTERNS: MaskingPattern[] = [
  { name: 'email', pattern: /test@test.com/g, replacement: '[EMAIL]' },
  { name: 'phone', pattern: /123-456/g, replacement: '[PHONE]' },
];`;
    const hashes = extractMaskingPatternHashes(content);
    expect(hashes).toHaveLength(2);
  });

  it('returns empty array for missing patterns', () => {
    const content = 'const OTHER_ARRAY = [];';
    const hashes = extractMaskingPatternHashes(content);
    expect(hashes).toHaveLength(0);
  });
});

describe('compareMaskingPatterns', () => {
  const source = `const MASKING_PATTERNS: MaskingPattern[] = [
  { name: 'email', pattern: /test/g, replacement: '[A]' },
  { name: 'phone', pattern: /123/g, replacement: '[B]' },
];`;

  it('detects matching patterns', () => {
    const result = compareMaskingPatterns(source, source);
    expect(result.match).toBe(true);
    expect(result.sourceCount).toBe(2);
  });

  it('detects count mismatch', () => {
    const target = `const MASKING_PATTERNS: MaskingPattern[] = [
  { name: 'email', pattern: /test/g, replacement: '[A]' },
];`;
    const result = compareMaskingPatterns(source, target);
    expect(result.match).toBe(false);
    expect(result.details).toContain('count mismatch');
  });

  it('detects content mismatch', () => {
    const target = `const MASKING_PATTERNS: MaskingPattern[] = [
  { name: 'email', pattern: /DIFFERENT/g, replacement: '[A]' },
  { name: 'phone', pattern: /123/g, replacement: '[B]' },
];`;
    const result = compareMaskingPatterns(source, target);
    expect(result.match).toBe(false);
    expect(result.details).toContain('differs');
  });
});

describe('hashContent', () => {
  it('produces consistent hashes', () => {
    const content = 'test content';
    expect(hashContent(content)).toBe(hashContent(content));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('content A')).not.toBe(hashContent('content B'));
  });

  it('returns 8-character hash', () => {
    expect(hashContent('test')).toHaveLength(8);
  });
});
