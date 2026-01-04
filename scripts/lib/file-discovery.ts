/**
 * File Discovery Module
 * Smart file discovery with relevance scoring, import graph tracking, and content search
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Type Definitions
// ============================================

export interface FileInfo {
  path: string;
  size: number;
  relevanceScore: number;
  pathScore: number;      // Score from path matching
  contentScore: number;   // Score from content matching
  matchedKeywords: string[]; // Which keywords matched
}

export interface ErrorLocation {
  file: string;        // File path or name
  line?: number;       // Line number (if available)
  column?: number;     // Column number (if available)
  functionName?: string; // Function name (if available)
  context?: string;    // Surrounding context from error message
}

export interface SearchContext {
  keywords: string[];
  errorLocations: ErrorLocation[];
  errorMessages: string[];
  functionNames: string[];
}

export interface ImportInfo {
  source: string;      // The import path as written
  resolved: string | null;  // Resolved file path (null if not found)
  isRelative: boolean; // Is it a relative import?
  type: 'import' | 'require' | 'dynamic'; // Type of import
}

// ============================================
// Error Location Extraction
// ============================================

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

  return Array.from(new Set(messages));
}

/**
 * Extract keywords from issue text
 */
export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // File paths
  // tsx/jsx before ts/js to prevent partial matches
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

  return Array.from(new Set(keywords));
}

// ============================================
// Content Search
// ============================================

/**
 * Search file content for keywords and calculate relevance
 * Uses sampling for large files to maintain performance
 */
export function searchFileContent(
  filePath: string,
  searchContext: SearchContext,
  maxReadSize = 50000 // Read max 50KB per file for performance
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  try {
    const content = fs.readFileSync(
      filePath,
      { encoding: 'utf-8', flag: 'r' }
    ).slice(0, maxReadSize).toLowerCase();

    // 1. Check for error location file matches (highest priority)
    for (const loc of searchContext.errorLocations) {
      const fileName = loc.file.toLowerCase();
      if (path.basename(filePath).toLowerCase() === fileName) {
        score += 50; // Direct file match from stack trace
        matchedKeywords.push(`stacktrace:${loc.file}`);

        // Bonus if we can find the specific line context
        if (loc.line && loc.functionName) {
          if (content.includes(loc.functionName.toLowerCase())) {
            score += 20;
            matchedKeywords.push(`function:${loc.functionName}`);
          }
        }
      }
    }

    // 2. Check for function names from error context
    for (const funcName of searchContext.functionNames) {
      const funcLower = funcName.toLowerCase();
      // Match function definitions or calls
      const patterns = [
        `function ${funcLower}`,
        `const ${funcLower}`,
        `${funcLower}(`,
        `${funcLower} =`,
        `.${funcLower}(`,
      ];
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          score += 25;
          matchedKeywords.push(`function:${funcName}`);
          break;
        }
      }
    }

    // 3. Check for error message fragments
    for (const errMsg of searchContext.errorMessages) {
      const msgWords = errMsg.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      let matchCount = 0;
      for (const word of msgWords) {
        if (content.includes(word)) matchCount++;
      }
      if (matchCount >= 2 || (msgWords.length === 1 && matchCount === 1)) {
        score += 15;
        matchedKeywords.push(`error:${errMsg.slice(0, 30)}`);
      }
    }

    // 4. General keyword matching in content
    for (const keyword of searchContext.keywords) {
      const keyLower = keyword.toLowerCase();
      if (keyLower.length < 3) continue; // Skip short keywords

      // Exact match (with word boundaries approximation)
      const exactMatches = content.split(keyLower).length - 1;
      if (exactMatches > 0) {
        score += Math.min(exactMatches * 5, 20); // Cap at 20 per keyword
        matchedKeywords.push(keyword);
      }
    }

  } catch {
    // File read error - skip content scoring
  }

  return { score, matchedKeywords: Array.from(new Set(matchedKeywords)) };
}

/**
 * Calculate path-based relevance score
 */
export function calculatePathRelevance(filePath: string, keywords: string[]): number {
  let score = 0;
  const lowerPath = filePath.toLowerCase();

  // Keyword matching in path
  for (const keyword of keywords) {
    if (keyword.length < 2) continue;
    if (lowerPath.includes(keyword.toLowerCase())) {
      score += 15;
    }
  }

  // File type priorities
  if (lowerPath.includes('error') || lowerPath.includes('exception')) score += 10;
  if (lowerPath.includes('handler') || lowerPath.includes('controller')) score += 8;
  if (lowerPath.includes('api/') || lowerPath.includes('route')) score += 7;
  if (lowerPath.includes('page.tsx') || lowerPath.includes('page.ts')) score += 6;
  if (lowerPath.includes('component')) score += 5;
  if (lowerPath.includes('hook') || lowerPath.includes('use')) score += 4;
  if (lowerPath.includes('store') || lowerPath.includes('state')) score += 4;
  if (lowerPath.includes('util') || lowerPath.includes('lib') || lowerPath.includes('helper')) score += 3;
  if (lowerPath.includes('service') || lowerPath.includes('client')) score += 3;
  if (lowerPath.includes('config') || lowerPath.includes('setting')) score += 2;

  // Penalize test files for bug analysis
  if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('__test__')) {
    score -= 10;
  }

  return score;
}

// ============================================
// File Discovery
// ============================================

export function findRelevantFiles(
  dir: string,
  keywords: string[],
  errorLocations: ErrorLocation[] = [],
  errorMessages: string[] = [],
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt'],
  ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor'],
  maxFiles = 25
): FileInfo[] {
  const files: FileInfo[] = [];

  // Extract function names from error locations
  const functionNames = errorLocations
    .filter(loc => loc.functionName)
    .map(loc => loc.functionName!);

  const searchContext: SearchContext = {
    keywords,
    errorLocations,
    errorMessages,
    functionNames,
  };

  function walk(currentDir: string, depth = 0): void {
    if (depth > 6) return;

    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);

        if (item.isDirectory()) {
          if (!item.name.startsWith('.') && !ignoreDirs.includes(item.name)) {
            walk(fullPath, depth + 1);
          }
        } else if (item.isFile()) {
          if (extensions.some((ext) => item.name.endsWith(ext))) {
            try {
              const stats = fs.statSync(fullPath);

              // Calculate path-based score first (fast)
              const pathScore = calculatePathRelevance(fullPath, keywords);

              files.push({
                path: fullPath,
                size: stats.size,
                pathScore,
                contentScore: 0, // Will be calculated later for top candidates
                relevanceScore: pathScore,
                matchedKeywords: [],
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }

        if (files.length >= 200) return; // Cap at 200 files for initial scan
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);

  // Sort by path score first
  files.sort((a, b) => b.pathScore - a.pathScore);

  // Content search on top 50 candidates (performance optimization)
  const topCandidates = files.slice(0, 50);

  console.log('   🔍 Searching file contents for keywords...');

  for (const file of topCandidates) {
    const { score: contentScore, matchedKeywords } = searchFileContent(file.path, searchContext);
    file.contentScore = contentScore;
    file.matchedKeywords = matchedKeywords;
    // Combined score: content is weighted higher (2x) than path
    file.relevanceScore = file.pathScore + (file.contentScore * 2);
  }

  // Re-sort by combined relevance score
  topCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Log top matches for debugging
  const topMatches = topCandidates.slice(0, 5).filter(f => f.relevanceScore > 0);
  if (topMatches.length > 0) {
    console.log('   📊 Content search results:');
    for (const match of topMatches) {
      console.log(`      - ${match.path} (score: ${match.relevanceScore}, keywords: ${match.matchedKeywords.slice(0, 3).join(', ')})`);
    }
  }

  return topCandidates.slice(0, maxFiles);
}

// ============================================
// Import Graph Tracking
// ============================================

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

/**
 * Resolve import path to actual file path
 * Handles common resolution patterns:
 * - Relative paths: ./foo, ../bar
 * - Extension inference: .ts, .tsx, .js, .jsx
 * - Index files: ./folder -> ./folder/index.ts
 * - Path aliases are NOT resolved (would need tsconfig)
 */
export function resolveImportPath(
  importSource: string,
  fromFile: string,
  baseDir: string
): string | null {
  // Skip non-relative imports (npm packages, path aliases)
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  // Calculate the base path
  let basePath: string;
  if (importSource.startsWith('/')) {
    basePath = path.join(baseDir, importSource);
  } else {
    basePath = path.join(fromDir, importSource);
  }

  // Try direct path with extensions
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try index file in directory
  for (const ext of extensions) {
    const indexPath = path.join(basePath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  // Try exact path (already has extension)
  if (fs.existsSync(basePath)) {
    return basePath;
  }

  return null;
}

/**
 * Build import graph from relevant files
 * Returns a map of file -> imported files
 */
export function buildImportGraph(
  files: FileInfo[],
  baseDir: string,
  maxFilesToParse = 20
): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  const filesToParse = files.slice(0, maxFilesToParse);

  for (const file of filesToParse) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const imports = parseImports(content);

      const resolvedImports: string[] = [];
      for (const imp of imports) {
        if (imp.isRelative) {
          const resolved = resolveImportPath(imp.source, file.path, baseDir);
          if (resolved) {
            resolvedImports.push(resolved);
          }
        }
      }

      if (resolvedImports.length > 0) {
        graph.set(file.path, resolvedImports);
      }
    } catch {
      // Skip files we can't read
    }
  }

  return graph;
}

/**
 * Expand file list with imported dependencies
 * Adds files that are imported by the top relevant files
 */
export function expandFilesWithImports(
  files: FileInfo[],
  importGraph: Map<string, string[]>,
  maxExpansion = 10
): FileInfo[] {
  const existingPaths = new Set(files.map(f => f.path));
  const newFiles: FileInfo[] = [];

  // Get all imported files that aren't already in our list
  for (const [sourceFile, imports] of Array.from(importGraph.entries())) {
    // Get the source file's score to derive imported file scores
    const sourceFileInfo = files.find(f => f.path === sourceFile);
    const baseScore = sourceFileInfo?.relevanceScore || 0;

    for (const importedPath of imports) {
      if (!existingPaths.has(importedPath) && newFiles.length < maxExpansion) {
        existingPaths.add(importedPath);

        try {
          const stats = fs.statSync(importedPath);
          newFiles.push({
            path: importedPath,
            size: stats.size,
            // Imported files get 60% of the importing file's score
            relevanceScore: Math.floor(baseScore * 0.6),
            pathScore: 0,
            contentScore: 0,
            matchedKeywords: [`imported-by:${path.basename(sourceFile)}`],
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  }

  // Sort new files by derived score
  newFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return [...files, ...newFiles];
}
