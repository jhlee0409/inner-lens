/**
 * Finder Agent (P5 Phase 1)
 *
 * Responsible for:
 * - Finding relevant files based on issue context
 * - Building import graph
 * - Extracting code chunks (AST-like)
 * - Building call graph (L2 only)
 * - LLM re-ranking (optional)
 *
 * Level 1: Basic file search + import graph + code chunks
 * Level 2: + Call graph analysis
 */

import { generateText } from 'ai';
import * as fs from 'fs';
import * as path from 'path';

import type {
  Agent,
  AgentConfig,
  FinderInput,
  FinderOutput,
  FileInfo,
  CodeChunk,
  ErrorLocation,
  CallGraphNode,
} from './types.js';

// Import analysis utilities
import {
  extractCodeChunks,
  buildCallGraph,
  findCallChain,
  getRelatedFunctions,
} from '../../src/utils/analysis.js';

// ============================================
// File Discovery
// ============================================

interface SearchContext {
  keywords: string[];
  errorLocations: ErrorLocation[];
  errorMessages: string[];
  functionNames: string[];
}

/**
 * Calculate path-based relevance score
 */
function calculatePathRelevance(filePath: string, keywords: string[]): number {
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

  // Penalize test files
  if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('__test__')) {
    score -= 10;
  }

  return score;
}

/**
 * Search file content for keywords and calculate relevance
 */
function searchFileContent(
  filePath: string,
  searchContext: SearchContext,
  maxReadSize = 50000
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  try {
    const content = fs.readFileSync(filePath, { encoding: 'utf-8', flag: 'r' }).slice(0, maxReadSize).toLowerCase();

    // 1. Stack trace file matches (highest priority)
    for (const loc of searchContext.errorLocations) {
      const fileName = loc.file.toLowerCase();
      if (path.basename(filePath).toLowerCase() === fileName) {
        score += 50;
        matchedKeywords.push(`stacktrace:${loc.file}`);

        if (loc.line && loc.functionName) {
          if (content.includes(loc.functionName.toLowerCase())) {
            score += 20;
            matchedKeywords.push(`function:${loc.functionName}`);
          }
        }
      }
    }

    // 2. Function names from error context
    for (const funcName of searchContext.functionNames) {
      const funcLower = funcName.toLowerCase();
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

    // 3. Error message fragments
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

    // 4. General keyword matching
    for (const keyword of searchContext.keywords) {
      const keyLower = keyword.toLowerCase();
      if (keyLower.length < 3) continue;

      const exactMatches = content.split(keyLower).length - 1;
      if (exactMatches > 0) {
        score += Math.min(exactMatches * 5, 20);
        matchedKeywords.push(keyword);
      }
    }
  } catch {
    // Skip files we can't read
  }

  return { score, matchedKeywords: [...new Set(matchedKeywords)] };
}

/**
 * Find relevant files in directory
 */
function findRelevantFiles(
  dir: string,
  keywords: string[],
  errorLocations: ErrorLocation[] = [],
  errorMessages: string[] = [],
  maxFiles = 25,
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt'],
  ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor']
): FileInfo[] {
  const files: FileInfo[] = [];

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
              const pathScore = calculatePathRelevance(fullPath, keywords);

              files.push({
                path: fullPath,
                size: stats.size,
                pathScore,
                contentScore: 0,
                relevanceScore: pathScore,
                matchedKeywords: [],
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }

        if (files.length >= 200) return;
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);

  // Sort by path score
  files.sort((a, b) => b.pathScore - a.pathScore);

  // Content search on top 50 candidates
  const topCandidates = files.slice(0, 50);

  for (const file of topCandidates) {
    const { score: contentScore, matchedKeywords } = searchFileContent(file.path, searchContext);
    file.contentScore = contentScore;
    file.matchedKeywords = matchedKeywords;
    file.relevanceScore = file.pathScore + contentScore * 2;
  }

  // Re-sort by combined score
  topCandidates.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return topCandidates.slice(0, maxFiles);
}

// ============================================
// Import Graph
// ============================================

interface ImportInfo {
  source: string;
  resolved: string | null;
  isRelative: boolean;
  type: 'import' | 'require' | 'dynamic';
}

function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const seenSources = new Set<string>();

  // ES6 imports
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

  // CommonJS require
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

  // Dynamic imports
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

  // Re-exports
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

function resolveImportPath(importSource: string, fromFile: string, baseDir: string): string | null {
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    return null;
  }

  const fromDir = path.dirname(fromFile);
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  let basePath: string;
  if (importSource.startsWith('/')) {
    basePath = path.join(baseDir, importSource);
  } else {
    basePath = path.join(fromDir, importSource);
  }

  // Try with extensions
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // Try index file
  for (const ext of extensions) {
    const indexPath = path.join(basePath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }

  // Try exact path
  if (fs.existsSync(basePath)) {
    return basePath;
  }

  return null;
}

function buildImportGraph(files: FileInfo[], baseDir: string, maxFilesToParse = 20): Map<string, string[]> {
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

function expandFilesWithImports(
  files: FileInfo[],
  importGraph: Map<string, string[]>,
  maxExpansion = 10
): FileInfo[] {
  const existingPaths = new Set(files.map(f => f.path));
  const newFiles: FileInfo[] = [];

  for (const [sourceFile, imports] of Array.from(importGraph.entries())) {
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

  newFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return [...files, ...newFiles];
}

// ============================================
// Code Context Building
// ============================================

/**
 * Get relevant chunks from a file based on error locations and keywords
 */
function getRelevantChunks(
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

      // Error location match
      for (const loc of errorLocations) {
        if (loc.line && loc.line >= chunk.startLine && loc.line <= chunk.endLine) {
          score += 100;
        }
        if (loc.functionName && chunk.name.toLowerCase().includes(loc.functionName.toLowerCase())) {
          score += 50;
        }
      }

      // Keyword matches
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
 * Build context using AST-like chunks
 */
function buildChunkedContext(
  relevantFiles: FileInfo[],
  errorLocations: ErrorLocation[],
  keywords: string[],
  maxTotalChars = 60000
): { context: string; chunks: CodeChunk[] } {
  const contextParts: string[] = [];
  const allChunks: CodeChunk[] = [];
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
          allChunks.push(chunk);
        }
      }

      if (fileContext.length > file.path.length + 10) {
        contextParts.push(fileContext);
      }
    }

    if (contextParts.length >= 10) break;
  }

  return {
    context: contextParts.join('\n\n'),
    chunks: allChunks,
  };
}

/**
 * Read file with focus on specific line
 */
function readFileWithLineContext(
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

    return `### ${filePath} (lines ${startLine + 1}-${endLine} of ${totalLines}, error at line ${targetLine})\n\`\`\`\n${contextContent}\n\`\`\``;
  } catch {
    return '';
  }
}

function readFileWithContext(filePath: string, maxChars = 4000): string {
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
 * Build fallback line-based context
 */
function buildLineContext(
  relevantFiles: FileInfo[],
  errorLocations: ErrorLocation[],
  maxTotalChars = 60000
): string {
  const contextParts: string[] = [];
  let totalChars = 0;
  const processedFiles = new Set<string>();

  // Priority 1: Files from stack traces
  for (const loc of errorLocations) {
    if (totalChars >= maxTotalChars) break;

    const matchingFile = relevantFiles.find(f =>
      path.basename(f.path).toLowerCase() === loc.file.toLowerCase()
    );

    if (matchingFile && !processedFiles.has(matchingFile.path)) {
      processedFiles.add(matchingFile.path);

      let context: string;
      if (loc.line) {
        context = readFileWithLineContext(matchingFile.path, loc.line, 20, 6000);
      } else {
        context = readFileWithContext(matchingFile.path, 4000);
      }

      if (context) {
        contextParts.push(context);
        totalChars += context.length;
      }
    }
  }

  // Priority 2: Remaining relevant files
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

// ============================================
// LLM Re-ranking
// ============================================

function extractFileSummary(filePath: string, maxChars = 800): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const importLines: string[] = [];
    const exportLines: string[] = [];
    const otherLines: string[] = [];

    const lines = content.split('\n');
    for (const line of lines.slice(0, 50)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || (trimmed.startsWith('const ') && trimmed.includes('require('))) {
        importLines.push(trimmed);
      } else if (trimmed.startsWith('export ')) {
        exportLines.push(trimmed);
      } else if (
        trimmed.startsWith('function ') ||
        trimmed.startsWith('class ') ||
        trimmed.startsWith('const ') ||
        trimmed.startsWith('interface ') ||
        trimmed.startsWith('type ')
      ) {
        otherLines.push(trimmed);
      }
    }

    const parts = [...exportLines.slice(0, 5), ...otherLines.slice(0, 10), ...importLines.slice(0, 3)];

    let summary = parts.join('\n').slice(0, maxChars);
    if (summary.length >= maxChars) {
      summary = summary.slice(0, maxChars - 3) + '...';
    }

    return summary || content.slice(0, maxChars);
  } catch {
    return '';
  }
}

interface RerankResult {
  path: string;
  score: number;
  reason: string;
}

async function rerankFilesWithLLM(
  files: FileInfo[],
  issueTitle: string,
  issueBody: string,
  config?: AgentConfig,
  maxCandidates = 15
): Promise<FileInfo[]> {
  if (files.length < 5 || !config?.model) {
    return files;
  }

  const candidates = files
    .slice(0, maxCandidates)
    .map((f, i) => ({
      path: f.path,
      summary: extractFileSummary(f.path),
      originalScore: f.relevanceScore,
      originalRank: i + 1,
    }))
    .filter(c => c.summary.length > 50);

  if (candidates.length < 3) {
    return files;
  }

  const rerankPrompt = `You are a code search expert. Given a bug report and a list of candidate files, rank them by relevance.

## Bug Report
**Title:** ${issueTitle}
**Description:** ${issueBody.slice(0, 1500)}

## Candidate Files (ranked by initial search score)
${candidates.map((c, i) => `
### [${i + 1}] ${c.path}
\`\`\`
${c.summary}
\`\`\`
`).join('\n')}

## Task
Rerank these files from MOST relevant to LEAST relevant for debugging this bug.
Output a JSON array of objects with: {"path": "file/path", "score": 0-100, "reason": "brief reason"}
Order by score descending. Only include files that are potentially relevant (score > 30).

IMPORTANT: Output ONLY the JSON array, no markdown code blocks or explanation.`;

  try {
    const { text } = await generateText({
      model: config.model,
      prompt: rerankPrompt,
      maxTokens: 1000,
      temperature: 0.1,
    });

    let rerankResults: RerankResult[];
    try {
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      rerankResults = JSON.parse(cleanText);
    } catch {
      return files;
    }

    if (!Array.isArray(rerankResults) || rerankResults.length === 0) {
      return files;
    }

    const scoreMap = new Map<string, number>();
    for (const result of rerankResults) {
      if (result.path && typeof result.score === 'number') {
        scoreMap.set(result.path, result.score * 2);
      }
    }

    const rerankedFiles = files.map(f => {
      const llmScore = scoreMap.get(f.path);
      if (llmScore !== undefined) {
        return {
          ...f,
          relevanceScore: Math.floor(llmScore * 0.7 + f.relevanceScore * 0.3),
          matchedKeywords: [...f.matchedKeywords, 'llm-reranked'],
        };
      }
      return f;
    });

    rerankedFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return rerankedFiles;
  } catch {
    return files;
  }
}

// ============================================
// Finder Agent Implementation
// ============================================

export const finderAgent: Agent<FinderInput, FinderOutput> = {
  name: 'finder',
  description: 'Finds relevant files, builds import graph and code chunks, optionally with call graph (L2)',
  requiredLevel: 1,

  async execute(input: FinderInput, config?: AgentConfig): Promise<FinderOutput> {
    const startTime = Date.now();

    try {
      const { issueContext, level, baseDir, maxFiles } = input;

      console.log(`\n🔍 Finder Agent (Level ${level}) starting...`);

      // Step 1: Find relevant files
      console.log('   📂 Finding relevant files...');
      let relevantFiles = findRelevantFiles(
        baseDir,
        issueContext.keywords,
        issueContext.errorLocations,
        issueContext.errorMessages,
        maxFiles
      );
      console.log(`   Found ${relevantFiles.length} relevant files`);

      // Step 2: Build import graph
      console.log('   🔗 Building import graph...');
      const importGraph = buildImportGraph(relevantFiles, baseDir);
      console.log(`   Parsed imports from ${importGraph.size} files`);

      if (importGraph.size > 0) {
        const originalCount = relevantFiles.length;
        relevantFiles = expandFilesWithImports(relevantFiles, importGraph);
        const addedCount = relevantFiles.length - originalCount;
        if (addedCount > 0) {
          console.log(`   Added ${addedCount} imported dependencies`);
        }
      }

      // Step 3: LLM re-ranking (optional)
      if (config?.model) {
        console.log('   🎯 LLM re-ranking candidates...');
        relevantFiles = await rerankFilesWithLLM(
          relevantFiles,
          issueContext.title,
          issueContext.body,
          config
        );
      }

      // Step 4: Extract code chunks
      console.log('   📦 Extracting code chunks...');
      const { context: chunkedContext, chunks: codeChunks } = buildChunkedContext(
        relevantFiles,
        issueContext.errorLocations,
        issueContext.keywords
      );

      let codeContext: string;
      if (chunkedContext.length > 500) {
        codeContext = chunkedContext;
        console.log(`   ✅ Extracted ${codeChunks.length} relevant code chunks`);
      } else {
        console.log('   ⚠️ Insufficient chunks, falling back to line-based context');
        codeContext = buildLineContext(relevantFiles, issueContext.errorLocations);
      }

      // Step 5: Build call graph (L2 only)
      let callGraph: Map<string, CallGraphNode> | undefined;
      if (level === 2) {
        console.log('   📊 Building call graph (L2)...');
        callGraph = buildCallGraph(codeChunks);
        console.log(`   Built call graph with ${callGraph.size} nodes`);

        // Find call chains for error functions
        for (const loc of issueContext.errorLocations.slice(0, 3)) {
          if (loc.functionName) {
            const chains = findCallChain(callGraph, loc.functionName);
            if (chains.length > 0) {
              console.log(`   📍 Call chain for ${loc.functionName}: ${chains[0]?.join(' → ')}`);
            }
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`   ✅ Finder completed in ${duration}ms`);

      return {
        agentName: 'finder',
        success: true,
        duration,
        data: {
          relevantFiles,
          importGraph,
          codeChunks,
          callGraph,
          codeContext,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        agentName: 'finder',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        data: {
          relevantFiles: [],
          importGraph: new Map(),
          codeChunks: [],
          codeContext: '',
        },
      };
    }
  },
};

export default finderAgent;
