/**
 * Code Chunking Module - AST-based code chunking for TypeScript/JavaScript
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

interface TreeSitterNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  namedChildCount: number;
  namedChild: (index: number) => TreeSitterNode | null;
  childForFieldName: (name: string) => TreeSitterNode | null;
  children: TreeSitterNode[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let parserPromise: Promise<{ parser: any; tsLanguage: any; tsxLanguage: any } | null> | null = null;
let treeSitterAvailable = true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getTreeSitterParser(): Promise<{ parser: any; tsLanguage: any; tsxLanguage: any } | null> {
  if (!treeSitterAvailable) {
    return null;
  }

  if (!parserPromise) {
    parserPromise = (async () => {
      try {
        // Dynamic import to avoid issues if packages are not installed
        const { Parser, Language } = await import('web-tree-sitter');

        // Initialize WASM
        await Parser.init();

        const parser = new Parser();

        // Find WASM files - handle both development and production paths
        const possiblePaths = [
          // When running from scripts/
          path.join(process.cwd(), 'node_modules/tree-sitter-typescript'),
          // When running from project root
          path.join(path.dirname(fileURLToPath(import.meta.url)), '../../node_modules/tree-sitter-typescript'),
        ];

        let wasmDir = '';
        for (const p of possiblePaths) {
          if (fs.existsSync(path.join(p, 'tree-sitter-typescript.wasm'))) {
            wasmDir = p;
            break;
          }
        }

        if (!wasmDir) {
          throw new Error('tree-sitter-typescript WASM files not found');
        }

        const tsLanguage = await Language.load(path.join(wasmDir, 'tree-sitter-typescript.wasm'));
        const tsxLanguage = await Language.load(path.join(wasmDir, 'tree-sitter-tsx.wasm'));

        return { parser, tsLanguage, tsxLanguage };
      } catch (error) {
        console.warn(`   ⚠️ tree-sitter initialization failed, using regex fallback: ${error instanceof Error ? error.message : error}`);
        treeSitterAvailable = false;
        return null;
      }
    })();
  }

  return parserPromise;
}

// ============================================
// AST-based Code Chunk Extraction
// ============================================

/**
 * Map tree-sitter node types to our chunk types
 */
function mapNodeType(nodeType: string): CodeChunk['type'] | null {
  switch (nodeType) {
    case 'function_declaration':
    case 'arrow_function':
    case 'method_definition':
    case 'generator_function_declaration':
      return 'function';
    case 'class_declaration':
      return 'class';
    case 'interface_declaration':
      return 'interface';
    case 'type_alias_declaration':
      return 'type';
    case 'lexical_declaration': // const, let, var
      return 'const';
    default:
      return null;
  }
}

/**
 * Extract name from a tree-sitter node based on its type
 */
function extractNodeName(node: TreeSitterNode): string {
  // Try common field names for name
  const nameNode = node.childForFieldName('name');
  if (nameNode) {
    return nameNode.text;
  }

  // For lexical declarations, get the variable name from the declarator
  if (node.type === 'lexical_declaration') {
    const declarator = node.namedChild(0);
    if (declarator) {
      const varName = declarator.childForFieldName('name');
      if (varName) {
        return varName.text;
      }
    }
  }

  // For arrow functions assigned to variables, try to find the variable name
  // This is handled by the parent lexical_declaration

  return 'anonymous';
}

/**
 * Extract signature from a node (first line, cleaned up)
 */
function extractSignature(node: TreeSitterNode, lines: string[]): string {
  const startLine = node.startPosition.row;
  if (startLine < lines.length) {
    const firstLine = lines[startLine].trim();
    // Remove body for cleaner signature
    return firstLine.replace(/\{.*$/, '').trim();
  }
  return '';
}

/**
 * Check if a lexical declaration contains an interesting value (function, object, array)
 */
function isInterestingDeclaration(node: TreeSitterNode): boolean {
  if (node.type !== 'lexical_declaration') {
    return true; // Non-declarations are always interesting
  }

  const declarator = node.namedChild(0);
  if (!declarator) return false;

  const value = declarator.childForFieldName('value');
  if (!value) return false;

  // Include arrow functions, objects, and arrays
  const interestingTypes = [
    'arrow_function',
    'function',
    'object',
    'array',
    'call_expression', // Factory functions
  ];

  return interestingTypes.includes(value.type);
}

/**
 * Extract code chunks using tree-sitter AST
 */
function extractCodeChunksAST(
  content: string,
  rootNode: TreeSitterNode
): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = content.split('\n');

  // Node types we want to extract
  const targetTypes = new Set([
    'function_declaration',
    'class_declaration',
    'interface_declaration',
    'type_alias_declaration',
    'lexical_declaration',
    'export_statement', // Need to look inside for actual declarations
  ]);

  function processNode(node: TreeSitterNode): void {
    // Handle export statements by looking at their children
    if (node.type === 'export_statement') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) {
          processNode(child);
        }
      }
      return;
    }

    const chunkType = mapNodeType(node.type);
    if (!chunkType) return;

    // Filter out uninteresting const declarations (simple values)
    if (node.type === 'lexical_declaration' && !isInterestingDeclaration(node)) {
      return;
    }

    const name = extractNodeName(node);
    const startLine = node.startPosition.row + 1; // 1-indexed
    const endLine = node.endPosition.row + 1;
    const contentLines = lines.slice(node.startPosition.row, node.endPosition.row + 1);
    const chunkContent = contentLines.join('\n');
    const signature = extractSignature(node, lines);

    chunks.push({
      type: chunkType,
      name,
      startLine,
      endLine,
      content: chunkContent,
      signature,
    });
  }

  // Process top-level nodes
  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const child = rootNode.namedChild(i);
    if (child && targetTypes.has(child.type)) {
      processNode(child);
    }
  }

  return chunks;
}

// ============================================
// Regex-based Fallback (Original Implementation)
// ============================================

/**
 * Extract code chunks using regex patterns (fallback)
 */
function extractCodeChunksRegex(content: string): CodeChunk[] {
  const lines = content.split('\n');
  const chunks: CodeChunk[] = [];

  // Track brace AND bracket depth for finding block ends
  function findBlockEnd(startIdx: number): number {
    let braceDepth = 0;
    let bracketDepth = 0;
    let foundOpen = false;
    let passedEquals = false;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        // Start counting only after '=' to skip type annotations like 'Type[]'
        if (!passedEquals) {
          if (char === '=') {
            passedEquals = true;
          }
          continue;
        }

        if (char === '{') {
          braceDepth++;
          foundOpen = true;
        } else if (char === '}') {
          braceDepth--;
        } else if (char === '[') {
          bracketDepth++;
          foundOpen = true;
        } else if (char === ']') {
          bracketDepth--;
        }

        if (foundOpen && braceDepth === 0 && bracketDepth === 0) {
          return i;
        }
      }
    }
    return lines.length - 1;
  }

  // Patterns to identify chunk starts
  const patterns = [
    // Exported functions
    {
      regex: /^export\s+(async\s+)?function\s+(\w+)\s*\(/m,
      type: 'function' as const,
      nameGroup: 2,
    },
    // Regular functions
    { regex: /^(async\s+)?function\s+(\w+)\s*\(/m, type: 'function' as const, nameGroup: 2 },
    // Arrow functions
    {
      regex: /^(?:export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*(:\s*[^=]+)?\s*=>/m,
      type: 'function' as const,
      nameGroup: 1,
    },
    // Const arrays/objects
    {
      regex: /^(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*[\[{]/m,
      type: 'const' as const,
      nameGroup: 1,
    },
    // Classes
    { regex: /^(?:export\s+)?class\s+(\w+)/m, type: 'class' as const, nameGroup: 1 },
    // Interfaces
    { regex: /^(?:export\s+)?interface\s+(\w+)/m, type: 'interface' as const, nameGroup: 1 },
    // Type aliases
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

        const chunkLines = lines.slice(i, endLine + 1);
        const chunkContent = chunkLines.join('\n');
        const signature = lineContent.replace(/\{.*$/, '').trim();

        chunks.push({
          type: pattern.type,
          name,
          startLine: i + 1,
          endLine: endLine + 1,
          content: chunkContent,
          signature,
        });

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
// Public API
// ============================================

/**
 * Extract logical code chunks from TypeScript/JavaScript source
 * Uses tree-sitter AST for accurate parsing, with regex fallback
 */
export async function extractCodeChunksAsync(content: string): Promise<CodeChunk[]> {
  const treeSitter = await getTreeSitterParser();

  if (treeSitter) {
    try {
      const { parser, tsLanguage } = treeSitter;
      parser.setLanguage(tsLanguage);
      const tree = parser.parse(content);
      return extractCodeChunksAST(content, tree.rootNode);
    } catch (error) {
      console.warn(`   ⚠️ tree-sitter parsing failed, using regex fallback: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Fallback to regex
  return extractCodeChunksRegex(content);
}

/**
 * Extract logical code chunks from TypeScript/JavaScript source (sync version)
 * Uses regex patterns - for backward compatibility
 */
export function extractCodeChunks(content: string): CodeChunk[] {
  return extractCodeChunksRegex(content);
}

// ============================================
// Chunk Relevance Scoring
// ============================================

/**
 * Get relevant chunks from a file based on error locations and keywords
 */
export async function getRelevantChunksAsync(
  filePath: string,
  errorLocations: ErrorLocation[],
  keywords: string[],
  maxChunks = 5
): Promise<CodeChunk[]> {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = await extractCodeChunksAsync(content);

    if (chunks.length === 0) return [];

    // Score chunks by relevance
    const scoredChunks = chunks.map(chunk => {
      let score = 0;

      // Check if any error location falls within this chunk
      for (const loc of errorLocations) {
        if (loc.line && loc.line >= chunk.startLine && loc.line <= chunk.endLine) {
          score += 100;
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

      // Boost for exported functions
      if (chunk.signature.startsWith('export')) {
        score += 5;
      }

      return { chunk, score };
    });

    return scoredChunks
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxChunks)
      .map(sc => sc.chunk);
  } catch {
    return [];
  }
}

/**
 * Get relevant chunks (sync version for backward compatibility)
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

    const scoredChunks = chunks.map(chunk => {
      let score = 0;

      for (const loc of errorLocations) {
        if (loc.line && loc.line >= chunk.startLine && loc.line <= chunk.endLine) {
          score += 100;
        }
        if (loc.functionName && chunk.name.toLowerCase().includes(loc.functionName.toLowerCase())) {
          score += 50;
        }
      }

      const chunkLower = (chunk.name + ' ' + chunk.signature).toLowerCase();
      for (const keyword of keywords) {
        if (keyword.length > 2 && chunkLower.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      if (chunk.signature.startsWith('export')) {
        score += 5;
      }

      return { chunk, score };
    });

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

    if (content.length <= maxChars) {
      return `### ${filePath} (${totalLines} lines)\n\`\`\`\n${content}\n\`\`\``;
    }

    const truncated = content.slice(0, maxChars);
    const truncatedLines = truncated.split('\n').length;

    return `### ${filePath} (showing ${truncatedLines}/${totalLines} lines)\n\`\`\`\n${truncated}\n... (truncated)\n\`\`\``;
  } catch {
    return '';
  }
}

/**
 * Read file with focus on specific line numbers from error locations
 */
export function readFileWithLineContext(
  filePath: string,
  targetLine: number,
  contextLines = 15,
  maxChars = 5000
): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    if (targetLine <= 0 || targetLine > totalLines) {
      return readFileWithContext(filePath, maxChars);
    }

    const startLine = Math.max(0, targetLine - 1 - contextLines);
    const endLine = Math.min(totalLines, targetLine - 1 + contextLines + 1);

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
 * Build context using AST-based chunks for precise code selection (async)
 */
export async function buildChunkedContextAsync(
  relevantFiles: FileInfo[],
  errorLocations: ErrorLocation[],
  keywords: string[],
  maxTotalChars = 60000
): Promise<string> {
  const contextParts: string[] = [];
  let totalChars = 0;

  for (const file of relevantFiles) {
    if (totalChars >= maxTotalChars) break;

    const chunks = await getRelevantChunksAsync(file.path, errorLocations, keywords);

    if (chunks.length > 0) {
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

    if (contextParts.length >= 10) break;
  }

  return contextParts.join('\n\n');
}

/**
 * Build context using AST-like chunks (sync version for backward compatibility)
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

  const processedFiles = new Set<string>();

  for (const loc of errorLocations) {
    if (totalChars >= maxTotalChars) break;

    const matchingFile = relevantFiles.find(
      f => path.basename(f.path).toLowerCase() === loc.file.toLowerCase()
    );

    if (matchingFile && !processedFiles.has(matchingFile.path)) {
      processedFiles.add(matchingFile.path);

      let context: string;
      if (loc.line) {
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

  for (const file of relevantFiles) {
    if (totalChars >= maxTotalChars) break;
    if (processedFiles.has(file.path)) continue;

    processedFiles.add(file.path);

    const allocatedChars = file.relevanceScore > 50 ? 4000 : 3000;
    const context = readFileWithContext(file.path, allocatedChars);

    if (context) {
      contextParts.push(context);
      totalChars += context.length;
    }

    if (processedFiles.size >= 15) break;
  }

  return contextParts.join('\n\n');
}
