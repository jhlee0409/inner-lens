/**
 * Analysis Utilities
 * Shared functions for bug report analysis
 * Used by scripts/analyze-issue.ts and tested independently
 */

import * as path from 'path';

// ============================================
// Error Location Extraction
// ============================================

/**
 * Represents a specific error location extracted from stack traces
 */
export interface ErrorLocation {
  file: string;        // File path or name
  line?: number;       // Line number (if available)
  column?: number;     // Column number (if available)
  functionName?: string; // Function name (if available)
  context?: string;    // Surrounding context from error message
}

/**
 * Extract error locations from stack traces and error messages
 * Supports multiple stack trace formats:
 * - Node.js: "at functionName (file.js:10:5)"
 * - Chrome: "at functionName (http://localhost:3000/file.js:10:5)"
 * - Firefox: "functionName@file.js:10:5"
 * - React: "at ComponentName (file.tsx:10:5)"
 * - Python: 'File "file.py", line 10, in function_name'
 * - Generic: "file.ts:10" or "file.ts:10:5"
 */
export function extractErrorLocations(text: string): ErrorLocation[] {
  const locations: ErrorLocation[] = [];
  const seenFiles = new Set<string>();

  // Pattern 1: Node.js/Chrome/React style - "at func (file:line:col)" or "at file:line:col"
  const nodePattern = /at\s+(?:(\w[\w.<>]*)\s+)?\(?(?:https?:\/\/[^/]+)?([^:)\s]+):(\d+):(\d+)\)?/g;
  let match;
  while ((match = nodePattern.exec(text)) !== null) {
    const file = match[2] || '';
    if (file && !seenFiles.has(file)) {
      seenFiles.add(file);
      locations.push({
        file: path.basename(file),
        line: parseInt(match[3] || '0', 10),
        column: parseInt(match[4] || '0', 10),
        functionName: match[1],
      });
    }
  }

  // Pattern 2: Firefox style - "functionName@file:line:col"
  const firefoxPattern = /(\w+)@([^:]+):(\d+):(\d+)/g;
  while ((match = firefoxPattern.exec(text)) !== null) {
    const file = match[2] || '';
    if (file && !seenFiles.has(file)) {
      seenFiles.add(file);
      locations.push({
        file: path.basename(file),
        line: parseInt(match[3] || '0', 10),
        column: parseInt(match[4] || '0', 10),
        functionName: match[1],
      });
    }
  }

  // Pattern 3: Python style - 'File "file.py", line 10'
  const pythonPattern = /File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(\w+))?/g;
  while ((match = pythonPattern.exec(text)) !== null) {
    const file = match[1] || '';
    if (file && !seenFiles.has(file)) {
      seenFiles.add(file);
      locations.push({
        file: path.basename(file),
        line: parseInt(match[2] || '0', 10),
        functionName: match[3],
      });
    }
  }

  // Pattern 4: Generic "file.ext:line" or "file.ext:line:col"
  const genericPattern = /([\w./-]+\.(ts|tsx|js|jsx|py|go|rs|java|kt)):(\d+)(?::(\d+))?/g;
  while ((match = genericPattern.exec(text)) !== null) {
    const file = match[1] || '';
    if (file && !seenFiles.has(file)) {
      seenFiles.add(file);
      locations.push({
        file: path.basename(file),
        line: parseInt(match[3] || '0', 10),
        column: match[4] ? parseInt(match[4], 10) : undefined,
      });
    }
  }

  // Pattern 5: Webpack/bundler - "webpack:///./src/file.tsx"
  const webpackPattern = /webpack:\/\/\/\.\/([^?:]+)(?::(\d+))?/g;
  while ((match = webpackPattern.exec(text)) !== null) {
    const file = match[1] || '';
    if (file && !seenFiles.has(file)) {
      seenFiles.add(file);
      locations.push({
        file: path.basename(file),
        line: match[2] ? parseInt(match[2], 10) : undefined,
      });
    }
  }

  return locations;
}

/**
 * Extract error messages and their context
 */
export function extractErrorMessages(text: string): string[] {
  const messages: string[] = [];

  // Common error patterns
  const patterns = [
    // JavaScript/TypeScript errors
    /(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):\s*(.+?)(?:\n|$)/gi,
    // React errors
    /(?:Uncaught|Unhandled)\s+(?:Error|Exception):\s*(.+?)(?:\n|$)/gi,
    // Generic "error:" or "Error:" messages
    /(?:error|Error|ERROR):\s*(.+?)(?:\n|$)/g,
    // Failed assertions
    /(?:AssertionError|assertion failed):\s*(.+?)(?:\n|$)/gi,
    // Network errors
    /(?:NetworkError|FetchError|AxiosError):\s*(.+?)(?:\n|$)/gi,
    // HTTP status errors
    /(?:4\d{2}|5\d{2})\s+(?:error|Error)?:?\s*(.+?)(?:\n|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].length > 3) {
        messages.push(match[1].trim());
      }
    }
  }

  return [...new Set(messages)];
}

// ============================================
// Import Parsing
// ============================================

export interface ImportInfo {
  source: string;      // The import path as written
  resolved: string | null;  // Resolved file path (null if not found)
  isRelative: boolean; // Is it a relative import?
  type: 'import' | 'require' | 'dynamic'; // Type of import
}

/**
 * Parse import statements from TypeScript/JavaScript file content
 * Supports:
 * - ES6 imports: import { x } from 'module'
 * - ES6 default imports: import x from 'module'
 * - ES6 namespace imports: import * as x from 'module'
 * - CommonJS: require('module')
 * - Dynamic imports: import('module')
 * - Re-exports: export { x } from 'module'
 */
export function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seenSources = new Set<string>();

  // Pattern 1: ES6 static imports - import ... from 'module'
  const es6ImportPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*\{[^}]*\})?)\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = es6ImportPattern.exec(content)) !== null) {
    const source = match[1];
    if (source && !seenSources.has(source)) {
      seenSources.add(source);
      imports.push({
        source,
        resolved: null,
        isRelative: source.startsWith('.') || source.startsWith('/'),
        type: 'import',
      });
    }
  }

  // Pattern 2: CommonJS require - require('module')
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requirePattern.exec(content)) !== null) {
    const source = match[1];
    if (source && !seenSources.has(source)) {
      seenSources.add(source);
      imports.push({
        source,
        resolved: null,
        isRelative: source.startsWith('.') || source.startsWith('/'),
        type: 'require',
      });
    }
  }

  // Pattern 3: Dynamic imports - import('module')
  const dynamicImportPattern = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = dynamicImportPattern.exec(content)) !== null) {
    const source = match[1];
    if (source && !seenSources.has(source)) {
      seenSources.add(source);
      imports.push({
        source,
        resolved: null,
        isRelative: source.startsWith('.') || source.startsWith('/'),
        type: 'dynamic',
      });
    }
  }

  // Pattern 4: Re-exports - export { x } from 'module'
  const reExportPattern = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g;
  while ((match = reExportPattern.exec(content)) !== null) {
    const source = match[1];
    if (source && !seenSources.has(source)) {
      seenSources.add(source);
      imports.push({
        source,
        resolved: null,
        isRelative: source.startsWith('.') || source.startsWith('/'),
        type: 'import',
      });
    }
  }

  return imports;
}

// ============================================
// Keyword Extraction
// ============================================

/**
 * Extract relevant keywords from bug report text
 */
export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // File paths - tsx/jsx before ts/js to prevent partial matches
  const filePathPattern = /(?:[\w-]+\/)*[\w-]+\.(tsx|ts|jsx|js|py|go|rs|java|kt)/g;
  keywords.push(...(text.match(filePathPattern) || []));

  // Error types
  const errorPattern = /(?:Error|Exception|TypeError|ReferenceError|SyntaxError|RuntimeError|NullPointerException)/g;
  keywords.push(...(text.match(errorPattern) || []));

  // Function/class names (PascalCase or camelCase)
  const identifierPattern = /\b[A-Z][a-zA-Z0-9]{2,}\b|\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  keywords.push(...(text.match(identifierPattern) || []).slice(0, 15));

  // Extract from error locations
  const locations = extractErrorLocations(text);
  keywords.push(...locations.map(loc => loc.file));
  keywords.push(...locations.filter(loc => loc.functionName).map(loc => loc.functionName!));

  return [...new Set(keywords)];
}

// ============================================
// AST-like Code Chunking (P3-1)
// ============================================

/**
 * Represents a logical code chunk (function, class, interface, etc.)
 */
export interface CodeChunk {
  type: 'function' | 'class' | 'interface' | 'type' | 'const' | 'export';
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  signature: string;
}

/**
 * Extract logical code chunks from TypeScript/JavaScript source
 * Uses regex patterns to identify function, class, and interface boundaries
 * This is a lightweight alternative to full AST parsing
 */
export function extractCodeChunks(content: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  // Track brace depth for finding block ends
  function findBlockEnd(startIdx: number): number {
    let depth = 0;
    let foundOpen = false;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i] || '';
      for (const char of line) {
        if (char === '{') {
          depth++;
          foundOpen = true;
        } else if (char === '}') {
          depth--;
          if (foundOpen && depth === 0) {
            return i;
          }
        }
      }
    }
    return lines.length - 1;
  }

  // Patterns to identify chunk starts
  const patterns = [
    // Exported functions: export function name(...) or export async function name(...)
    { regex: /^export\s+(async\s+)?function\s+(\w+)\s*\(/m, type: 'function' as const, nameGroup: 2 },
    // Regular functions: function name(...) or async function name(...)
    { regex: /^(async\s+)?function\s+(\w+)\s*\(/m, type: 'function' as const, nameGroup: 2 },
    // Arrow functions: const name = (...) => or const name = async (...) =>
    { regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*(:\s*[^=]+)?\s*=>/m, type: 'function' as const, nameGroup: 1 },
    // Classes: class Name or export class Name
    { regex: /^(?:export\s+)?class\s+(\w+)/m, type: 'class' as const, nameGroup: 1 },
    // Interfaces: interface Name
    { regex: /^(?:export\s+)?interface\s+(\w+)/m, type: 'interface' as const, nameGroup: 1 },
    // Type aliases: type Name =
    { regex: /^(?:export\s+)?type\s+(\w+)\s*=/m, type: 'type' as const, nameGroup: 1 },
  ];

  const processedLines = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (processedLines.has(i)) continue;

    const lineContent = (lines[i] || '').trim();
    if (!lineContent || lineContent.startsWith('//') || lineContent.startsWith('*')) continue;

    for (const pattern of patterns) {
      const match = lineContent.match(pattern.regex);
      if (match) {
        const name = match[pattern.nameGroup] || 'anonymous';
        const endLine = findBlockEnd(i);

        // Extract the chunk content
        const chunkLines = lines.slice(i, endLine + 1);
        const chunkContent = chunkLines.join('\n');

        // Extract signature (first line, cleaned up)
        const signature = lineContent.replace(/\{.*$/, '').trim();

        chunks.push({
          type: pattern.type,
          name,
          startLine: i + 1, // 1-indexed
          endLine: endLine + 1,
          content: chunkContent,
          signature,
        });

        // Mark these lines as processed
        for (let j = i; j <= endLine; j++) {
          processedLines.add(j);
        }
        break;
      }
    }
  }

  return chunks;
}

/**
 * Score chunks by relevance to error locations and keywords
 */
export function scoreChunk(
  chunk: CodeChunk,
  errorLocations: ErrorLocation[],
  keywords: string[]
): number {
  let score = 0;

  // Check if any error location falls within this chunk
  for (const loc of errorLocations) {
    if (loc.line && loc.line >= chunk.startLine && loc.line <= chunk.endLine) {
      score += 100; // High priority for error location match
    }
    if (loc.functionName && chunk.name.toLowerCase().includes(loc.functionName.toLowerCase())) {
      score += 50;
    }
  }

  // Check keyword matches
  const chunkLower = (chunk.name + ' ' + chunk.signature).toLowerCase();
  for (const keyword of keywords) {
    if (keyword.length > 2 && chunkLower.includes(keyword.toLowerCase())) {
      score += 10;
    }
  }

  // Boost for exported functions (more likely to be entry points)
  if (chunk.signature.startsWith('export')) {
    score += 5;
  }

  return score;
}
