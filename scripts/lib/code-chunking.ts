/**
 * Code Chunking Module
 *
 * AST-like code chunking for TypeScript/JavaScript source files.
 * Uses regex patterns to identify function, class, and interface boundaries
 * without requiring full AST parsing.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { ErrorLocation, FileInfo } from './file-discovery';

// ============================================
// Types
// ============================================

export interface CodeChunk {
  type: 'function' | 'class' | 'interface' | 'type' | 'const';
  name: string;
  startLine: number;
  endLine: number;
  content: string;
  signature: string;
}

// ============================================
// Code Chunk Extraction
// ============================================

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
      const line = lines[i];
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
    {
      regex: /^export\s+(async\s+)?function\s+(\w+)\s*\(/m,
      type: 'function' as const,
      nameGroup: 2,
    },
    // Regular functions: function name(...) or async function name(...)
    { regex: /^(async\s+)?function\s+(\w+)\s*\(/m, type: 'function' as const, nameGroup: 2 },
    // Arrow functions: const name = (...) => or const name = async (...) =>
    {
      regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*(:\s*[^=]+)?\s*=>/m,
      type: 'function' as const,
      nameGroup: 1,
    },
    // Const arrays/objects: const NAME = [ or const NAME = {
    {
      regex: /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*[\[{]/m,
      type: 'const' as const,
      nameGroup: 1,
    },
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

    const lineContent = lines[i].trim();
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

// ============================================
// Chunk Relevance Scoring
// ============================================

/**
 * Get relevant chunks from a file based on error locations and keywords
 */
export function getRelevantChunks(
  filePath: string,
  errorLocations: ErrorLocation[],
  keywords: string[],
  maxChunks = 5
): CodeChunk[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = extractCodeChunks(content);

    if (chunks.length === 0) return [];

    // Score chunks by relevance
    const scoredChunks = chunks.map(chunk => {
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

      return { chunk, score };
    });

    // Sort by score and return top chunks
    return scoredChunks
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks)
      .map(sc => sc.chunk);
  } catch {
    return [];
  }
}

// ============================================
// File Reading Utilities
// ============================================

/**
 * Read file with basic context and truncation
 */
export function readFileWithContext(filePath: string, maxChars = 4000): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // If file is small enough, return all
    if (content.length <= maxChars) {
      return `### ${filePath} (${totalLines} lines)\n\`\`\`\n${content}\n\`\`\``;
    }

    // Otherwise, try to include important parts
    const truncated = content.slice(0, maxChars);
    const truncatedLines = truncated.split('\n').length;

    return `### ${filePath} (showing ${truncatedLines}/${totalLines} lines)\n\`\`\`\n${truncated}\n... (truncated)\n\`\`\``;
  } catch {
    return '';
  }
}

/**
 * Read file with focus on specific line numbers from error locations
 * Provides context around the error line for better analysis
 */
export function readFileWithLineContext(
  filePath: string,
  targetLine: number,
  contextLines = 15, // Lines before and after
  maxChars = 5000
): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Validate target line
    if (targetLine <= 0 || targetLine > totalLines) {
      return readFileWithContext(filePath, maxChars);
    }

    // Calculate range (1-indexed to 0-indexed)
    const startLine = Math.max(0, targetLine - 1 - contextLines);
    const endLine = Math.min(totalLines, targetLine - 1 + contextLines + 1);

    // Extract lines with line numbers
    const contextContent = lines
      .slice(startLine, endLine)
      .map((line, idx) => {
        const lineNum = startLine + idx + 1;
        const marker = lineNum === targetLine ? '>>>' : '   ';
        return `${marker} ${lineNum.toString().padStart(4)}: ${line}`;
      })
      .join('\n');

    const header = `### ${filePath} (lines ${startLine + 1}-${endLine} of ${totalLines}, error at line ${targetLine})`;

    return `${header}\n\`\`\`\n${contextContent}\n\`\`\``;
  } catch {
    return '';
  }
}

// ============================================
// Context Building
// ============================================

/**
 * Build context using AST-like chunks for more precise code selection
 */
export function buildChunkedContext(
  relevantFiles: FileInfo[],
  errorLocations: ErrorLocation[],
  keywords: string[],
  maxTotalChars = 60000
): string {
  const contextParts: string[] = [];
  let totalChars = 0;

  for (const file of relevantFiles) {
    if (totalChars >= maxTotalChars) break;

    const chunks = getRelevantChunks(file.path, errorLocations, keywords);

    if (chunks.length > 0) {
      // Build chunk-based context
      let fileContext = `### ${file.path}\n`;

      for (const chunk of chunks) {
        const chunkHeader = `#### ${chunk.type}: ${chunk.name} (lines ${chunk.startLine}-${chunk.endLine})\n`;
        const chunkCode = `\`\`\`typescript\n${chunk.content}\n\`\`\`\n`;

        if (totalChars + chunkHeader.length + chunkCode.length < maxTotalChars) {
          fileContext += chunkHeader + chunkCode;
          totalChars += chunkHeader.length + chunkCode.length;
        }
      }

      if (fileContext.length > file.path.length + 10) {
        contextParts.push(fileContext);
      }
    }

    // Stop after processing top files
    if (contextParts.length >= 10) break;
  }

  return contextParts.join('\n\n');
}

/**
 * Build prioritized code context from error locations and relevant files
 */
export function buildCodeContext(
  relevantFiles: FileInfo[],
  errorLocations: ErrorLocation[],
  maxTotalChars = 60000
): string {
  const contextParts: string[] = [];
  let totalChars = 0;

  // Priority 1: Files directly from stack traces with line context
  const processedFiles = new Set<string>();

  for (const loc of errorLocations) {
    if (totalChars >= maxTotalChars) break;

    // Find matching file in relevantFiles
    const matchingFile = relevantFiles.find(
      f => path.basename(f.path).toLowerCase() === loc.file.toLowerCase()
    );

    if (matchingFile && !processedFiles.has(matchingFile.path)) {
      processedFiles.add(matchingFile.path);

      let context: string;
      if (loc.line) {
        // Read with line-focused context
        context = readFileWithLineContext(matchingFile.path, loc.line, 20, 6000);
        console.log(`   📍 Priority context: ${matchingFile.path}:${loc.line}`);
      } else {
        context = readFileWithContext(matchingFile.path, 4000);
      }

      if (context) {
        contextParts.push(context);
        totalChars += context.length;
      }
    }
  }

  // Priority 2: Remaining relevant files (by score)
  for (const file of relevantFiles) {
    if (totalChars >= maxTotalChars) break;
    if (processedFiles.has(file.path)) continue;

    processedFiles.add(file.path);

    // Allocate more space to higher-scored files
    const allocatedChars = file.relevanceScore > 50 ? 4000 : 3000;
    const context = readFileWithContext(file.path, allocatedChars);

    if (context) {
      contextParts.push(context);
      totalChars += context.length;
    }

    // Stop after 15 files to avoid context overflow
    if (processedFiles.size >= 15) break;
  }

  return contextParts.join('\n\n');
}
