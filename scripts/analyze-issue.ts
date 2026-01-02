/**
 * inner-lens Analysis Engine v2
 * Enhanced with 2025 best practices:
 * - Chain-of-Thought reasoning
 * - Structured JSON output
 * - Context-aware file selection
 * - Rate limiting with retry
 * - Improved security
 */

import { generateText, generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Type Definitions
// ============================================

type AIProvider = 'anthropic' | 'openai' | 'google';

interface AnalysisConfig {
  provider: AIProvider;
  model: string;
  issueNumber: number;
  owner: string;
  repo: string;
  maxFiles: number;
  maxTokens: number;
  retryAttempts: number;
  retryDelay: number;
  // Self-consistency settings (P3-2)
  selfConsistency: boolean;
  consistencySamples: number;
  consistencyThreshold: number;
  // AST-like chunking (P3-1)
  useChunking: boolean;
}

// Structured output schema for analysis
// Schema for a single root cause analysis
const RootCauseAnalysisSchema = z.object({
  severity: z.enum(['critical', 'high', 'medium', 'low', 'none']),
  category: z.enum(['runtime_error', 'logic_error', 'performance', 'security', 'ui_ux', 'configuration', 'invalid_report', 'unknown']),
  codeVerification: z.object({
    bugExistsInCode: z.boolean().describe('After analyzing the code, does the described bug actually exist?'),
    evidence: z.string().describe('What evidence from the code supports or refutes the bug claim?'),
    alternativeExplanation: z.string().optional().describe('If not a bug, what might explain the reported behavior?'),
  }).describe('Result of verifying the bug claim against actual code'),
  rootCause: z.object({
    summary: z.string().describe('One-line summary of the root cause'),
    explanation: z.string().describe('Detailed explanation of why the bug occurred'),
    affectedFiles: z.array(z.string()).describe('List of files likely causing the issue'),
  }),
  suggestedFix: z.object({
    steps: z.array(z.string()).describe('Step-by-step instructions to fix the bug'),
    codeChanges: z.array(z.object({
      file: z.string(),
      description: z.string(),
      before: z.string().optional(),
      after: z.string(),
    })).describe('Specific code changes to implement'),
  }),
  prevention: z.array(z.string()).describe('How to prevent similar issues in the future'),
  confidence: z.number().min(0).max(100).describe('Confidence level of this analysis (0-100)'),
  additionalContext: z.string().optional().describe('Any additional context or caveats'),
});

const AnalysisResultSchema = z.object({
  // Validity check - MUST be evaluated first
  isValidReport: z.boolean().describe('Whether this is a valid, actionable bug report with sufficient information'),
  invalidReason: z.string().optional().describe('If isValidReport is false, explain why (e.g., "No error logs or reproduction steps provided", "Description too vague to analyze")'),

  // Report classification (2025 enhancement)
  reportType: z.enum([
    'bug',              // Actual bug - code is broken
    'not_a_bug',        // Expected behavior - user misunderstanding
    'feature_request',  // Request for new functionality
    'improvement',      // Enhancement to existing feature
    'cannot_verify',    // Cannot confirm bug from code analysis
    'needs_info',       // Insufficient information to analyze
  ]).describe('Classification of what this report actually is'),

  // Multiple root causes support - each will be posted as a separate comment
  analyses: z.array(RootCauseAnalysisSchema)
    .min(1)
    .max(3)
    .describe('Array of potential root causes, ordered by likelihood. Each will be posted as a separate comment. Usually 1, but can be 2-3 if multiple distinct issues are found.'),
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
type RootCauseAnalysis = z.infer<typeof RootCauseAnalysisSchema>;

// ============================================
// Configuration
// ============================================

const config: AnalysisConfig = {
  provider: (process.env['AI_PROVIDER'] as AIProvider) || 'anthropic',
  model: process.env['AI_MODEL'] || '',
  issueNumber: parseInt(process.env['ISSUE_NUMBER'] || '0', 10),
  owner: process.env['REPO_OWNER'] || '',
  repo: process.env['REPO_NAME'] || '',
  maxFiles: parseInt(process.env['MAX_FILES'] || '25', 10),
  maxTokens: parseInt(process.env['MAX_TOKENS'] || '4000', 10),
  retryAttempts: 3,
  retryDelay: 2000,
  // Self-consistency: run multiple analyses and check agreement (P3-2)
  selfConsistency: process.env['SELF_CONSISTENCY'] === 'true',
  consistencySamples: parseInt(process.env['CONSISTENCY_SAMPLES'] || '3', 10),
  consistencyThreshold: parseFloat(process.env['CONSISTENCY_THRESHOLD'] || '0.67'),
  // AST-like chunking: use function/class level chunking (P3-1)
  useChunking: process.env['USE_CHUNKING'] !== 'false', // Default enabled
};

// ============================================
// Model Selection
// ============================================

// Default models for each provider (2026 latest)
const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4.1',
  google: 'gemini-2.0-flash',
};

function getModel() {
  const modelName = config.model || DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case 'openai':
      console.log(`📦 Using OpenAI ${modelName}`);
      return openai(modelName);
    case 'google':
      console.log(`📦 Using Google ${modelName}`);
      return google(modelName);
    case 'anthropic':
    default:
      console.log(`📦 Using Anthropic ${modelName}`);
      return anthropic(modelName);
  }
}

// ============================================
// Security: Enhanced Data Masking
// ============================================

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  // Email addresses
  [/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/gi, '[EMAIL]'],
  // Bearer tokens
  [/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer [TOKEN]'],
  // OpenAI keys
  [/sk-[a-zA-Z0-9]{20,}/g, '[OPENAI_KEY]'],
  // Anthropic keys
  [/sk-ant-[a-zA-Z0-9\-]{20,}/g, '[ANTHROPIC_KEY]'],
  // GitHub tokens
  [/gh[pousr]_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN]'],
  // AWS keys
  [/AKIA[A-Z0-9]{16}/g, '[AWS_KEY]'],
  // JWT tokens
  [/eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_.+/=]*/g, '[JWT]'],
  // Generic secrets
  [/(?:password|passwd|pwd|secret|token|apikey|api_key|private_key)[=:\s]+["']?[^\s"']{8,}["']?/gi, '[REDACTED]'],
  // Database URLs
  [/(?:mongodb|mysql|postgresql|postgres|redis):\/\/[^\s"']+/gi, '[DATABASE_URL]'],
  // IP addresses
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]'],
  // Credit card numbers
  [/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD_NUMBER]'],
];

function maskSensitiveData(text: string): string {
  let masked = text;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// ============================================
// Import Graph Tracking (P1-1)
// ============================================

interface ImportInfo {
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
function parseImports(content: string): ImportInfo[] {
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
function resolveImportPath(
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
function buildImportGraph(
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
function expandFilesWithImports(
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

// ============================================
// LLM Re-ranking (P1-2)
// ============================================

/**
 * Extract a brief summary of a file for LLM re-ranking
 */
function extractFileSummary(filePath: string, maxChars = 800): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract imports and exports first (useful context)
    const importLines: string[] = [];
    const exportLines: string[] = [];
    const otherLines: string[] = [];

    const lines = content.split('\n');
    for (const line of lines.slice(0, 50)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import ') || trimmed.startsWith('const ') && trimmed.includes('require(')) {
        importLines.push(trimmed);
      } else if (trimmed.startsWith('export ')) {
        exportLines.push(trimmed);
      } else if (trimmed.startsWith('function ') || trimmed.startsWith('class ') ||
                 trimmed.startsWith('const ') || trimmed.startsWith('interface ') ||
                 trimmed.startsWith('type ')) {
        otherLines.push(trimmed);
      }
    }

    // Build summary prioritizing structure
    const parts = [
      ...exportLines.slice(0, 5),
      ...otherLines.slice(0, 10),
      ...importLines.slice(0, 3),
    ];

    let summary = parts.join('\n').slice(0, maxChars);
    if (summary.length >= maxChars) {
      summary = summary.slice(0, maxChars - 3) + '...';
    }

    return summary || content.slice(0, maxChars);
  } catch {
    return '';
  }
}

interface RerankCandidate {
  path: string;
  summary: string;
  originalScore: number;
  originalRank: number;
}

interface RerankResult {
  path: string;
  newScore: number;
  reason: string;
}

/**
 * Use LLM to re-rank file candidates based on relevance to the bug report
 * Uses a fast/cheap model to minimize cost and latency
 */
async function rerankFilesWithLLM(
  files: FileInfo[],
  issueTitle: string,
  issueBody: string,
  maxCandidates = 15
): Promise<FileInfo[]> {
  // Only rerank if we have enough candidates
  if (files.length < 5) {
    return files;
  }

  const candidates: RerankCandidate[] = files
    .slice(0, maxCandidates)
    .map((f, i) => ({
      path: f.path,
      summary: extractFileSummary(f.path),
      originalScore: f.relevanceScore,
      originalRank: i + 1,
    }))
    .filter(c => c.summary.length > 50); // Skip empty summaries

  if (candidates.length < 3) {
    return files;
  }

  // Build the re-ranking prompt
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
    // Use the cheapest/fastest model for re-ranking (2025 pricing)
    // OpenAI gpt-4.1-nano: $0.10/$0.40 per 1M tokens
    // Google gemini-2.5-flash-lite: $0.10/$0.40 per 1M tokens
    // Anthropic claude-3-haiku: $0.25/$1.25 per 1M tokens (cheapest available)
    let rerankModel;
    switch (config.provider) {
      case 'openai':
        rerankModel = openai('gpt-4.1-nano');
        break;
      case 'google':
        rerankModel = google('gemini-2.5-flash-lite');
        break;
      case 'anthropic':
      default:
        rerankModel = anthropic('claude-3-haiku-20240307');
        break;
    }

    const { text } = await generateText({
      model: rerankModel,
      prompt: rerankPrompt,
      maxTokens: 1000,
      temperature: 0.1, // Low temperature for consistent ranking
    });

    // Parse the response
    let rerankResults: RerankResult[];
    try {
      // Clean up the response (remove markdown code blocks if present)
      let cleanText = text.trim();
      if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      rerankResults = JSON.parse(cleanText);
    } catch (parseError) {
      console.log('   ⚠️ Could not parse LLM re-ranking response, using original order');
      return files;
    }

    if (!Array.isArray(rerankResults) || rerankResults.length === 0) {
      return files;
    }

    // Create a map of path -> new score
    const scoreMap = new Map<string, number>();
    for (const result of rerankResults) {
      if (result.path && typeof result.score === 'number') {
        // Normalize LLM score (0-100) to our scale
        scoreMap.set(result.path, result.score * 2); // Scale to ~0-200 range
      }
    }

    // Update file scores based on LLM ranking
    const rerankedFiles = files.map(f => {
      const llmScore = scoreMap.get(f.path);
      if (llmScore !== undefined) {
        return {
          ...f,
          // Blend original score with LLM score (70% LLM, 30% original for top candidates)
          relevanceScore: Math.floor(llmScore * 0.7 + f.relevanceScore * 0.3),
          matchedKeywords: [...f.matchedKeywords, 'llm-reranked'],
        };
      }
      return f;
    });

    // Re-sort by updated scores
    rerankedFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return rerankedFiles;
  } catch (error) {
    console.log(`   ⚠️ LLM re-ranking failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return files;
  }
}

// ============================================
// Smart File Discovery
// ============================================

interface FileInfo {
  path: string;
  size: number;
  relevanceScore: number;
  pathScore: number;      // Score from path matching
  contentScore: number;   // Score from content matching
  matchedKeywords: string[]; // Which keywords matched
}

interface SearchContext {
  keywords: string[];
  errorLocations: ErrorLocation[];
  errorMessages: string[];
  functionNames: string[];
}

/**
 * Search file content for keywords and calculate relevance
 * Uses sampling for large files to maintain performance
 */
function searchFileContent(
  filePath: string,
  searchContext: SearchContext,
  maxReadSize = 50000 // Read max 50KB per file for performance
): { score: number; matchedKeywords: string[] } {
  let score = 0;
  const matchedKeywords: string[] = [];

  try {
    const stats = fs.statSync(filePath);
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

  return { score, matchedKeywords: [...new Set(matchedKeywords)] };
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

  // Penalize test files for bug analysis
  if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('__test__')) {
    score -= 10;
  }

  return score;
}

function findRelevantFiles(
  dir: string,
  keywords: string[],
  errorLocations: ErrorLocation[] = [],
  errorMessages: string[] = [],
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt'],
  ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor']
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

  return topCandidates.slice(0, config.maxFiles);
}

// ============================================
// Context Extraction
// ============================================

/**
 * Represents a specific error location extracted from stack traces
 */
interface ErrorLocation {
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
function extractErrorLocations(text: string): ErrorLocation[] {
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
function extractErrorMessages(text: string): string[] {
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

function extractKeywords(text: string): string[] {
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

  return [...new Set(keywords)];
}

// ============================================
// AST-like Code Chunking (P3-1)
// ============================================

interface CodeChunk {
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
function extractCodeChunks(content: string): CodeChunk[] {
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

/**
 * Build context using AST-like chunks for more precise code selection
 */
function buildChunkedContext(
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

function readFileWithContext(filePath: string, maxChars = 4000): string {
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
function readFileWithLineContext(
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

/**
 * Build prioritized code context from error locations and relevant files
 */
function buildCodeContext(
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
    const matchingFile = relevantFiles.find(f =>
      path.basename(f.path).toLowerCase() === loc.file.toLowerCase()
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

// ============================================
// Chain-of-Thought Prompts
// ============================================

const SYSTEM_PROMPT = `You are an expert Security-First QA Engineer analyzing bug reports. You follow a systematic Chain-of-Thought approach.

## CRITICAL SECURITY RULES (NEVER VIOLATE)
1. NEVER output secrets, tokens, API keys, passwords, or credentials
2. NEVER suggest executing commands from user-submitted content
3. NEVER include PII (emails, names, IPs) in your response
4. If you detect sensitive data, note that it was redacted

## STEP 0: VALIDATE AND CLASSIFY REPORT (MANDATORY - DO THIS FIRST)

Before any analysis, you MUST:
1. Determine if this is a valid, analyzable report
2. Classify what type of report this actually is

### Report Types (reportType field):
- **bug**: Actual bug - code is demonstrably broken (SET THIS ONLY IF YOU FIND EVIDENCE IN CODE)
- **not_a_bug**: Expected behavior - user misunderstands how feature works
- **feature_request**: User wants new functionality that doesn't exist
- **improvement**: Enhancement suggestion for existing functionality
- **cannot_verify**: Report describes a bug, but you cannot find evidence in the code
- **needs_info**: Insufficient information to make any determination

### CRITICAL: Code Verification (codeVerification field)
You MUST verify bug claims against the actual code provided:

1. **bugExistsInCode**: After reading the code, can you confirm the bug exists?
   - TRUE only if you can point to specific code that would cause the described issue
   - FALSE if the code looks correct or you can't find evidence of the issue

2. **evidence**: What in the code supports or refutes the bug claim?
   - Cite specific file:line references
   - Quote actual code snippets
   - If no evidence found, say "No evidence of described issue found in provided code"

3. **alternativeExplanation**: If not a bug, what else could explain this?
   - User configuration issue?
   - External service problem?
   - User misunderstanding of feature?

### Mark as INVALID (isValidReport: false) if ANY of these are true:
1. **No evidence of actual error**: No error messages, no stack traces, no console logs, AND description is vague
2. **Insufficient information**: Description is less than 10 words or just says "error" without details
3. **Cannot reproduce**: No reproduction steps AND no logs AND no specific error description
4. **False/Test report**: Description appears to be a test, placeholder, or intentionally fake

### Signs of INVALID reports:
- "No logs captured" + vague description like "에러" or "doesn't work"
- Description only contains generic words without specific symptoms
- No URL context + no logs + no error messages

### When codeVerification.bugExistsInCode is FALSE:
Even if the report seems valid, if you cannot find evidence in the code:
- Set reportType: "cannot_verify" or "not_a_bug"
- Do NOT suggest code fixes for bugs you cannot verify
- Instead, suggest debugging steps or request more information

**Only suggest code fixes when you have CONFIRMED the bug exists in the code**

## ANALYSIS METHODOLOGY (Chain-of-Thought) - Only for VALID reports

### Step 1: UNDERSTAND
- Read the bug report carefully
- Identify the symptoms (what is happening)
- Identify the expected behavior (what should happen)
- Note any error messages or stack traces

### Step 2: HYPOTHESIZE
- Based on symptoms, form hypotheses about root causes
- Consider common bug patterns for this type of issue
- Rank hypotheses by likelihood

### Step 3: INVESTIGATE
- Examine the provided code context
- Look for evidence supporting or refuting each hypothesis
- Trace the data/control flow

### Step 4: CONCLUDE
- Identify the most likely root cause with evidence
- Determine the specific file(s) and line(s) involved
- Assess the severity and impact

### Step 5: RECOMMEND
- Provide specific, actionable fix steps
- Include code changes when possible
- Suggest preventive measures

## OUTPUT QUALITY REQUIREMENTS
- Be specific and actionable, not generic
- Reference actual file names and code from the context
- Provide working code snippets, not pseudocode
- Explain WHY the fix works, not just WHAT to change
- DO NOT fabricate issues that don't exist in the code
- If you cannot find evidence of a bug, say so honestly

## EVIDENCE-BASED ANALYSIS RULES (P3-2 Enhancement)

### Rule 1: Code Location Citation (MANDATORY)
Every claim about the code MUST include a precise location reference:
- Format: \`filename.ts:lineNumber\` (e.g., \`server.ts:42\`)
- When suggesting fixes, specify the exact line range to modify
- If line numbers are marked with >>> in the context, prioritize those lines

### Rule 2: Evidence Chain
Build a traceable path from error to root cause:
1. **Error Point**: Where the error manifests (from stack trace or logs)
2. **Call Path**: How execution reached that point
3. **Root Cause**: The actual source of the bug
Each step must cite code evidence.

### Rule 3: Confidence Calibration
Your confidence score MUST reflect actual evidence quality:
- **90-100%**: Stack trace points directly to the issue + code clearly shows the bug
- **70-89%**: Strong circumstantial evidence from code patterns
- **50-69%**: Reasonable inference but missing direct evidence
- **Below 50%**: Speculative - state this clearly and request more info

### Rule 4: Counter-Evidence Check
Before finalizing analysis, ask yourself:
- "What evidence would DISPROVE this hypothesis?"
- "Are there alternative explanations for this behavior?"
- "What assumptions am I making that might be wrong?"
If counter-evidence exists, mention it and explain why your conclusion is still valid.

### Rule 5: No Speculation Without Disclosure
If you must speculate (due to incomplete information):
- Prefix with "⚠️ Speculative:" or similar marker
- Explain what additional information would confirm/deny the speculation
- Lower confidence score accordingly

## MULTIPLE ROOT CAUSES (analyses array)

The output schema supports multiple root cause analyses. Use this when:

### When to return MULTIPLE analyses (2-3):
- The bug report describes multiple distinct issues (e.g., "login fails AND profile page crashes")
- You find evidence of unrelated bugs in the same code area
- The symptoms could be caused by completely different root causes

### When to return SINGLE analysis (1):
- There is one clear root cause
- Multiple symptoms trace back to the same underlying issue
- You're not confident about alternative causes

### Guidelines:
- Order analyses by likelihood (most likely first)
- Each analysis should be INDEPENDENT and COMPLETE with its own:
  - severity, category, codeVerification
  - rootCause (summary, explanation, affectedFiles)
  - suggestedFix (steps, codeChanges)
  - prevention, confidence, additionalContext
- Do NOT split one issue into multiple analyses just to fill the array
- Maximum 3 analyses - if more potential causes exist, mention them in additionalContext`;

const USER_PROMPT_TEMPLATE = (
  title: string,
  body: string,
  codeContext: string,
  keywords: string[]
) => `Analyze this bug report using the Chain-of-Thought methodology:

## Bug Report

### Title
${title}

### Description
${body}

### Extracted Keywords
${keywords.join(', ')}

## Code Context
${codeContext || 'No relevant code files found in the repository.'}

---

Please analyze this bug step-by-step following the methodology, then provide your structured analysis.`;

// ============================================
// Retry Logic
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`⚠️ Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

// ============================================
// Self-Consistency Verification (P3-2)
// ============================================

/**
 * Calculate similarity between two root cause summaries
 * Uses simple word overlap as a heuristic
 */
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '');
  const words1 = new Set(normalize(text1).split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(normalize(text2).split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }

  // Jaccard similarity
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check if multiple analysis results are consistent
 * Returns the most common result with consistency metadata
 */
function checkConsistency(
  results: AnalysisResult[],
  threshold: number
): { result: AnalysisResult; isConsistent: boolean; agreementRate: number } {
  if (results.length === 0) {
    throw new Error('No results to check consistency');
  }

  if (results.length === 1) {
    return { result: results[0], isConsistent: true, agreementRate: 1.0 };
  }

  // Group by validity first
  const validResults = results.filter(r => r.isValidReport);
  const invalidResults = results.filter(r => !r.isValidReport);

  // If majority says invalid, use that
  if (invalidResults.length > validResults.length) {
    return {
      result: invalidResults[0],
      isConsistent: invalidResults.length === results.length,
      agreementRate: invalidResults.length / results.length,
    };
  }

  // For valid reports, check root cause similarity (using first analysis)
  const summaries = validResults.map(r => r.analyses[0]?.rootCause.summary || '');
  const similarityMatrix: number[][] = [];

  for (let i = 0; i < summaries.length; i++) {
    similarityMatrix[i] = [];
    for (let j = 0; j < summaries.length; j++) {
      similarityMatrix[i][j] = i === j ? 1 : calculateSimilarity(summaries[i], summaries[j]);
    }
  }

  // Find the result with highest average similarity to others
  let bestIdx = 0;
  let bestAvgSim = 0;
  for (let i = 0; i < summaries.length; i++) {
    const avgSim = similarityMatrix[i].reduce((a, b) => a + b, 0) / summaries.length;
    if (avgSim > bestAvgSim) {
      bestAvgSim = avgSim;
      bestIdx = i;
    }
  }

  // Count how many agree with the best result
  const agreementCount = similarityMatrix[bestIdx].filter(sim => sim >= 0.5).length;
  const agreementRate = agreementCount / results.length;

  return {
    result: validResults[bestIdx],
    isConsistent: agreementRate >= threshold,
    agreementRate,
  };
}

/**
 * Run analysis with self-consistency verification
 * Generates multiple analyses and checks for agreement
 */
async function analyzeWithConsistency(
  generateFn: () => Promise<AnalysisResult>,
  numSamples: number,
  threshold: number
): Promise<AnalysisResult> {
  console.log(`   🔄 Running ${numSamples} parallel analyses for consistency check...`);

  // Run analyses in parallel
  const promises = Array(numSamples).fill(null).map(() => generateFn());
  const results = await Promise.allSettled(promises);

  const successfulResults: AnalysisResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successfulResults.push(result.value);
    }
  }

  if (successfulResults.length === 0) {
    throw new Error('All consistency samples failed');
  }

  // Check consistency
  const { result, isConsistent, agreementRate } = checkConsistency(successfulResults, threshold);

  console.log(`   📊 Agreement rate: ${(agreementRate * 100).toFixed(0)}% (${successfulResults.length} samples)`);

  if (!isConsistent) {
    console.log(`   ⚠️ Low consistency detected - adding warning to result`);
    // Adjust the result to indicate low consistency - update each analysis in the array
    const warningMessage = `\n\n⚠️ **Consistency Warning**: Multiple analysis runs showed ${(agreementRate * 100).toFixed(0)}% agreement. ` +
      `This analysis may benefit from manual verification.`;

    return {
      ...result,
      analyses: result.analyses.map(analysis => ({
        ...analysis,
        confidence: Math.min(analysis.confidence, 50),
        additionalContext: (analysis.additionalContext || '') + warningMessage,
      })),
    };
  }

  console.log(`   ✅ High consistency confirmed`);
  return result;
}

// ============================================
// Analysis Result Formatting
// ============================================

interface FormatOptions {
  provider: string;
  model: string;
  filesAnalyzed: number;
  analysisIndex?: number;  // 1-based index for multiple analyses
  totalAnalyses?: number;  // Total number of analyses
}

/**
 * Format comment for invalid/insufficient reports
 */
function formatInvalidReportComment(
  invalidReason: string | undefined,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';

  return `## 🔍 inner-lens Analysis

⚪ **Report Status:** INSUFFICIENT INFORMATION

---

### ❓ Unable to Analyze

This bug report does not contain enough information for automated analysis.

**Reason:** ${invalidReason || 'The report lacks sufficient details, error logs, or reproduction steps.'}

---

### 📝 What We Need

To analyze this issue, please provide:

1. **Error messages or stack traces** - Copy the exact error from the console
2. **Steps to reproduce** - What actions lead to this bug?
3. **Expected vs actual behavior** - What should happen vs what actually happens?
4. **Console logs** - Enable log capture in inner-lens widget

---

### 🔄 Next Steps

- **Update this issue** with more details, OR
- **Submit a new report** with the inner-lens widget (ensure console logging is enabled)

---

<details>
<summary>Analysis Metadata</summary>

| Field | Value |
|-------|-------|
| Status | Invalid/Insufficient |
| Provider | ${options.provider} |
| Model | ${modelDisplay} |
| Files Scanned | ${options.filesAnalyzed} |
| Timestamp | ${new Date().toISOString()} |

</details>

*This analysis was generated by [inner-lens](https://github.com/jhlee0409/inner-lens).*`;
}

/**
 * Format comment for non-bug reports (feature requests, not a bug, etc.)
 */
function formatNonBugReportComment(
  reportType: AnalysisResult['reportType'],
  analysis: RootCauseAnalysis,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';
  const reportTypeLabels: Record<string, { emoji: string; label: string }> = {
    bug: { emoji: '🐛', label: 'Confirmed Bug' },
    not_a_bug: { emoji: '✅', label: 'Not a Bug' },
    feature_request: { emoji: '💡', label: 'Feature Request' },
    improvement: { emoji: '🔧', label: 'Improvement Suggestion' },
    cannot_verify: { emoji: '🔍', label: 'Cannot Verify' },
    needs_info: { emoji: '❓', label: 'Needs More Info' },
  };

  const reportTypeInfo = reportTypeLabels[reportType] || reportTypeLabels.cannot_verify;

  return `## 🔍 inner-lens Analysis

${reportTypeInfo.emoji} **Classification:** ${reportTypeInfo.label}

---

### 📋 Analysis Result

${analysis.codeVerification?.bugExistsInCode === false
  ? `**Code Verification:** ❌ No bug found in code

${analysis.codeVerification.evidence}

${analysis.codeVerification.alternativeExplanation ? `**Possible Explanation:** ${analysis.codeVerification.alternativeExplanation}` : ''}`
  : `${analysis.rootCause.explanation}`}

---

${reportType === 'feature_request' || reportType === 'improvement' ? `### 💡 Recommendation

This appears to be a ${reportType === 'feature_request' ? 'feature request' : 'suggested improvement'} rather than a bug report.

Consider:
- Creating a separate feature request issue
- Discussing in a GitHub Discussion or community channel
- Checking if this feature already exists in the roadmap
` : ''}

${reportType === 'not_a_bug' ? `### ✅ Expected Behavior

The reported behavior appears to be working as designed.

${analysis.codeVerification?.alternativeExplanation || 'Please review the documentation for expected functionality.'}
` : ''}

${reportType === 'cannot_verify' ? `### 🔍 Unable to Confirm

We analyzed the relevant code but could not find evidence of the reported bug.

**What this means:**
- The bug may exist in code we didn't analyze
- The issue may be environment-specific
- More information may be needed

**Suggested next steps:**
1. Provide console logs with the error
2. Share steps to reproduce
3. Include the exact error message
` : ''}

---

<details>
<summary>Analysis Metadata</summary>

| Field | Value |
|-------|-------|
| Classification | ${reportTypeInfo.label} |
| Bug Found in Code | ${analysis.codeVerification?.bugExistsInCode ? 'Yes' : 'No'} |
| Confidence | ${analysis.confidence}% |
| Provider | ${options.provider} |
| Model | ${modelDisplay} |
| Files Analyzed | ${options.filesAnalyzed} |
| Timestamp | ${new Date().toISOString()} |

</details>

*This analysis was generated by [inner-lens](https://github.com/jhlee0409/inner-lens). Always verify suggestions before applying.*`;
}

/**
 * Format comment for a single root cause analysis (bug report)
 */
function formatRootCauseComment(
  analysis: RootCauseAnalysis,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    none: '⚪',
  };

  const categoryLabels: Record<string, string> = {
    runtime_error: 'Runtime Error',
    logic_error: 'Logic Error',
    performance: 'Performance Issue',
    security: 'Security Issue',
    ui_ux: 'UI/UX Issue',
    configuration: 'Configuration Issue',
    invalid_report: 'Invalid Report',
    unknown: 'Unknown',
  };

  const codeChangesSection = analysis.suggestedFix.codeChanges
    .map((change) => {
      let section = `#### 📄 \`${change.file}\`\n${change.description}\n`;
      if (change.before) {
        section += `\n**Before:**\n\`\`\`\n${change.before}\n\`\`\`\n`;
      }
      section += `\n**After:**\n\`\`\`\n${change.after}\n\`\`\``;
      return section;
    })
    .join('\n\n');

  // Show analysis number if there are multiple analyses
  const analysisHeader = options.totalAnalyses && options.totalAnalyses > 1
    ? `## 🔍 inner-lens Analysis (${options.analysisIndex}/${options.totalAnalyses})`
    : '## 🔍 inner-lens Analysis';

  return `${analysisHeader}

${severityEmoji[analysis.severity]} **Severity:** ${analysis.severity.toUpperCase()} | **Category:** ${categoryLabels[analysis.category]} | **Confidence:** ${analysis.confidence}%

---

### 🎯 Root Cause

**${analysis.rootCause.summary}**

${analysis.rootCause.explanation}

${analysis.rootCause.affectedFiles.length > 0 ? `**Affected Files:** ${analysis.rootCause.affectedFiles.map(f => `\`${f}\``).join(', ')}` : ''}

---

### 🔧 Suggested Fix

${analysis.suggestedFix.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${codeChangesSection ? `\n#### Code Changes\n\n${codeChangesSection}` : ''}

---

### 🛡️ Prevention

${analysis.prevention.map((p) => `- ${p}`).join('\n')}

${analysis.additionalContext ? `\n---\n\n### 📝 Additional Notes\n\n${analysis.additionalContext}` : ''}

---

<details>
<summary>Analysis Metadata</summary>

| Field | Value |
|-------|-------|
| Provider | ${options.provider} |
| Model | ${modelDisplay} |
| Files Analyzed | ${options.filesAnalyzed} |
| Timestamp | ${new Date().toISOString()} |
| Confidence | ${analysis.confidence}% |
${options.totalAnalyses && options.totalAnalyses > 1 ? `| Analysis | ${options.analysisIndex} of ${options.totalAnalyses} |` : ''}

</details>

*This analysis was generated by [inner-lens](https://github.com/jhlee0409/inner-lens). Always verify suggestions before applying.*`;
}

// ============================================
// Main Analysis Function
// ============================================

async function analyzeIssue(): Promise<void> {
  console.log('🔍 inner-lens Analysis Engine v2 Starting...\n');
  console.log(`📋 Issue: ${config.owner}/${config.repo}#${config.issueNumber}`);
  console.log(`🤖 Provider: ${config.provider}`);

  if (!config.issueNumber || !config.owner || !config.repo) {
    throw new Error('Missing required environment variables: ISSUE_NUMBER, REPO_OWNER, REPO_NAME');
  }

  const octokit = new Octokit({ auth: process.env['GITHUB_TOKEN'] });

  // Step 1: Fetch issue
  console.log('\n📥 Step 1: Fetching issue details...');
  const { data: issue } = await octokit.issues.get({
    owner: config.owner,
    repo: config.repo,
    issue_number: config.issueNumber,
  });

  const maskedTitle = maskSensitiveData(issue.title);
  const maskedBody = maskSensitiveData(issue.body || '');
  console.log(`   Title: ${maskedTitle.slice(0, 80)}...`);

  // Step 2: Extract context from issue
  console.log('\n🔑 Step 2: Extracting context...');

  const issueText = `${issue.title} ${issue.body || ''}`;

  // 2a. Extract error locations from stack traces
  const errorLocations = extractErrorLocations(issueText);
  if (errorLocations.length > 0) {
    console.log(`   📍 Found ${errorLocations.length} error locations from stack trace:`);
    errorLocations.slice(0, 3).forEach(loc => {
      console.log(`      - ${loc.file}${loc.line ? `:${loc.line}` : ''}${loc.functionName ? ` (${loc.functionName})` : ''}`);
    });
  } else {
    console.log('   📍 No stack trace locations found');
  }

  // 2b. Extract error messages
  const errorMessages = extractErrorMessages(issueText);
  if (errorMessages.length > 0) {
    console.log(`   💬 Found ${errorMessages.length} error messages:`);
    errorMessages.slice(0, 2).forEach(msg => {
      console.log(`      - "${msg.slice(0, 60)}${msg.length > 60 ? '...' : ''}"`);
    });
  }

  // 2c. Extract general keywords
  const keywords = extractKeywords(issueText);
  console.log(`   🔤 Found ${keywords.length} keywords: ${keywords.slice(0, 5).join(', ')}...`);

  // Step 3: Find relevant files using enhanced search
  console.log('\n📂 Step 3: Finding relevant files...');
  let relevantFiles = findRelevantFiles('.', keywords, errorLocations, errorMessages);
  console.log(`   Found ${relevantFiles.length} relevant files`);

  if (relevantFiles.length > 0) {
    console.log('   Top 5 by relevance:');
    relevantFiles.slice(0, 5).forEach((f, i) => {
      const matchInfo = f.matchedKeywords.length > 0 ? ` [${f.matchedKeywords.slice(0, 2).join(', ')}]` : '';
      console.log(`   ${i + 1}. ${f.path} (score: ${f.relevanceScore})${matchInfo}`);
    });
  }

  // Step 3.5: Expand with import graph (P1-1)
  console.log('\n🔗 Step 3.5: Building import graph...');
  const importGraph = buildImportGraph(relevantFiles, '.');
  console.log(`   Parsed imports from ${importGraph.size} files`);

  if (importGraph.size > 0) {
    const originalCount = relevantFiles.length;
    relevantFiles = expandFilesWithImports(relevantFiles, importGraph);
    const addedCount = relevantFiles.length - originalCount;

    if (addedCount > 0) {
      console.log(`   Added ${addedCount} imported dependencies:`);
      relevantFiles.slice(originalCount, originalCount + 5).forEach((f) => {
        console.log(`      + ${f.path} (${f.matchedKeywords[0] || 'dependency'})`);
      });
    } else {
      console.log('   No new dependencies found');
    }
  }

  // Step 3.6: LLM Re-ranking (P1-2)
  console.log('\n🎯 Step 3.6: LLM re-ranking candidates...');
  const beforeRerank = relevantFiles.slice(0, 5).map(f => f.path);
  relevantFiles = await rerankFilesWithLLM(
    relevantFiles,
    maskedTitle,
    maskedBody
  );
  const afterRerank = relevantFiles.slice(0, 5).map(f => f.path);

  // Check if ranking changed
  const rankChanged = beforeRerank.some((p, i) => afterRerank[i] !== p);
  if (rankChanged) {
    console.log('   ✅ Re-ranking applied. New top 5:');
    relevantFiles.slice(0, 5).forEach((f, i) => {
      const isReranked = f.matchedKeywords.includes('llm-reranked');
      console.log(`   ${i + 1}. ${f.path} (score: ${f.relevanceScore})${isReranked ? ' 🔄' : ''}`);
    });
  } else {
    console.log('   Original ranking maintained');
  }

  // Step 4: Build code context with priority on error locations
  console.log('\n📖 Step 4: Building code context...');

  let codeContext: string;

  // Use AST-like chunking if enabled (P3-1)
  if (config.useChunking) {
    console.log('   📦 Using AST-like code chunking (P3-1)');
    const chunkedContext = buildChunkedContext(relevantFiles, errorLocations, keywords, 60000);

    // If chunking found relevant chunks, use it; otherwise fallback to line-based
    if (chunkedContext.length > 500) {
      codeContext = chunkedContext;
      console.log('   ✅ Code chunks extracted successfully');
    } else {
      console.log('   ⚠️ Insufficient chunks found, falling back to line-based context');
      codeContext = buildCodeContext(relevantFiles, errorLocations, 60000);
    }
  } else {
    codeContext = buildCodeContext(relevantFiles, errorLocations, 60000);
  }

  const contextSize = codeContext.length;
  console.log(`   Context size: ${(contextSize / 1024).toFixed(1)} KB`);

  // Step 5: Generate analysis with retry
  console.log('\n🤖 Step 5: Generating AI analysis...');
  const model = getModel();

  const userPrompt = USER_PROMPT_TEMPLATE(maskedTitle, maskedBody, codeContext, keywords);

  // Single analysis generation function
  const generateAnalysis = async (): Promise<AnalysisResult> => {
    const { object } = await generateObject({
      model,
      schema: AnalysisResultSchema,
      system: SYSTEM_PROMPT,
      prompt: userPrompt,
      maxTokens: config.maxTokens,
    });
    return object;
  };

  let analysis: AnalysisResult;

  try {
    // Use self-consistency if enabled (P3-2)
    if (config.selfConsistency) {
      console.log('   🔄 Self-consistency mode enabled');
      analysis = await analyzeWithConsistency(
        () => withRetry(generateAnalysis, config.retryAttempts, config.retryDelay),
        config.consistencySamples,
        config.consistencyThreshold
      );
    } else {
      // Standard single analysis
      const result = await withRetry(generateAnalysis, config.retryAttempts, config.retryDelay);
      analysis = result;
    }
    console.log('   ✅ Structured analysis generated');
  } catch (structuredError) {
    // Fallback to text generation if structured fails
    console.log('   ⚠️ Structured output failed, falling back to text generation...');

    const { text } = await withRetry(
      async () =>
        generateText({
          model,
          system: SYSTEM_PROMPT,
          prompt: userPrompt + '\n\nProvide your analysis in a structured format.',
          maxTokens: config.maxTokens,
        }),
      config.retryAttempts,
      config.retryDelay
    );

    // Create a basic structured result from text (using new schema with analyses array)
    analysis = {
      isValidReport: true, // Assume valid if we got this far
      reportType: 'cannot_verify', // Conservative default for fallback
      analyses: [{
        severity: 'medium',
        category: 'unknown',
        codeVerification: {
          bugExistsInCode: false,
          evidence: 'Unable to perform structured code verification (fallback mode)',
        },
        rootCause: {
          summary: 'Analysis generated from unstructured response',
          explanation: text,
          affectedFiles: relevantFiles.slice(0, 3).map((f) => f.path),
        },
        suggestedFix: {
          steps: ['Review the analysis above', 'Identify the specific changes needed', 'Implement and test the fix'],
          codeChanges: [],
        },
        prevention: ['Add automated tests for this scenario', 'Consider adding error handling'],
        confidence: 50,
        additionalContext: 'This analysis was generated using fallback text mode. Structured output was not available.',
      }],
    };
    console.log('   ✅ Fallback analysis generated');
  }

  // Step 6: Post comments (one per root cause analysis)
  console.log('\n💬 Step 6: Posting analysis comments...');

  const formatOptions: FormatOptions = {
    provider: config.provider,
    model: config.model,
    filesAnalyzed: relevantFiles.length,
  };

  // Handle invalid reports - single comment
  if (!analysis.isValidReport) {
    const commentBody = formatInvalidReportComment(analysis.invalidReason, formatOptions);
    await octokit.issues.createComment({
      owner: config.owner,
      repo: config.repo,
      issue_number: config.issueNumber,
      body: commentBody,
    });
    console.log('   📝 Posted invalid report comment');
  }
  // Handle non-bug reports - single comment using first analysis
  else if (analysis.reportType !== 'bug') {
    const firstAnalysis = analysis.analyses[0];
    if (firstAnalysis) {
      const commentBody = formatNonBugReportComment(analysis.reportType, firstAnalysis, formatOptions);
      await octokit.issues.createComment({
        owner: config.owner,
        repo: config.repo,
        issue_number: config.issueNumber,
        body: commentBody,
      });
      console.log('   📝 Posted non-bug report comment');
    }
  }
  // Handle bug reports - one comment per root cause analysis
  else {
    const totalAnalyses = analysis.analyses.length;
    console.log(`   📊 Found ${totalAnalyses} root cause(s) to report`);

    for (let i = 0; i < totalAnalyses; i++) {
      const rootCauseAnalysis = analysis.analyses[i];
      if (!rootCauseAnalysis) continue;

      const commentBody = formatRootCauseComment(rootCauseAnalysis, {
        ...formatOptions,
        analysisIndex: i + 1,
        totalAnalyses,
      });

      await octokit.issues.createComment({
        owner: config.owner,
        repo: config.repo,
        issue_number: config.issueNumber,
        body: commentBody,
      });
      console.log(`   📝 Posted analysis comment ${i + 1}/${totalAnalyses}`);

      // Small delay between comments to avoid rate limiting
      if (i < totalAnalyses - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  // Step 7: Add labels based on analysis
  console.log('\n🏷️ Step 7: Adding labels...');
  const labelsToAdd: string[] = ['analyzed']; // Always add 'analyzed' to prevent duplicate runs

  // Handle invalid reports
  if (!analysis.isValidReport) {
    labelsToAdd.push('needs-more-info');
    console.log('   📋 Report marked as invalid/insufficient');
  } else {
    // Add labels based on report type
    switch (analysis.reportType) {
      case 'bug':
        // Check all analyses for severity and verification
        for (const rootCauseAnalysis of analysis.analyses) {
          if (rootCauseAnalysis.severity === 'critical' || rootCauseAnalysis.severity === 'high') {
            labelsToAdd.push('priority:high');
          }
          if (rootCauseAnalysis.codeVerification?.bugExistsInCode) {
            labelsToAdd.push('ai:bug-confirmed');
          }
          if (rootCauseAnalysis.category === 'security') {
            labelsToAdd.push('security');
          }
        }
        // Add confidence indicator based on highest confidence analysis
        const maxConfidence = Math.max(...analysis.analyses.map(a => a.confidence));
        if (maxConfidence >= 80) {
          labelsToAdd.push('ai:high-confidence');
        } else if (maxConfidence < 50) {
          labelsToAdd.push('ai:low-confidence');
        }
        // Add label indicating multiple root causes
        if (analysis.analyses.length > 1) {
          labelsToAdd.push('multiple-causes');
        }
        break;
      case 'not_a_bug':
        labelsToAdd.push('not-a-bug');
        break;
      case 'feature_request':
        labelsToAdd.push('enhancement');
        break;
      case 'improvement':
        labelsToAdd.push('enhancement');
        break;
      case 'cannot_verify':
        labelsToAdd.push('needs-reproduction');
        break;
      case 'needs_info':
        labelsToAdd.push('needs-more-info');
        break;
    }
  }

  // Add labels (filter out duplicates)
  const uniqueLabels = [...new Set(labelsToAdd)];

  if (uniqueLabels.length > 0) {
    try {
      await octokit.issues.addLabels({
        owner: config.owner,
        repo: config.repo,
        issue_number: config.issueNumber,
        labels: uniqueLabels,
      });
      console.log(`   Added labels: ${uniqueLabels.join(', ')}`);
    } catch {
      console.log('   ⚠️ Could not add labels (may not exist in repo)');
    }
  }

  console.log('\n✅ Analysis complete!');
  console.log(`🔗 https://github.com/${config.owner}/${config.repo}/issues/${config.issueNumber}`);
}

// ============================================
// Execute
// ============================================

analyzeIssue().catch((error) => {
  console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
