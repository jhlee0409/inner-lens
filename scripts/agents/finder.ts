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
  ExtractedIntent,
  InferredFile,
} from './types.js';

import {
  extractCodeChunks,
  buildCallGraph,
  findCallChain,
  getRelatedFunctions,
} from '../../src/utils/analysis.js';

import {
  findRelevantFiles,
  buildImportGraph,
  expandFilesWithImports,
  buildChunkedContext,
  buildCodeContext,
  getRelevantChunks,
} from '../lib/index.js';







function getProjectFileTree(baseDir: string, maxDepth = 4, maxFiles = 200): string {
  const files: string[] = [];
  const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor', '.cache'];
  const relevantExtensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.go', '.rs', '.java', '.kt'];

  function walk(dir: string, depth: number, prefix: string): void {
    if (depth > maxDepth || files.length >= maxFiles) return;

    try {
      const items = fs.readdirSync(dir, { withFileTypes: true })
        .filter(item => !item.name.startsWith('.') && !ignoreDirs.includes(item.name))
        .sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });

      for (const item of items) {
        if (files.length >= maxFiles) return;

        const relativePath = path.join(prefix, item.name);
        if (item.isDirectory()) {
          files.push(`${relativePath}/`);
          walk(path.join(dir, item.name), depth + 1, relativePath);
        } else if (relevantExtensions.some(ext => item.name.endsWith(ext))) {
          files.push(relativePath);
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  walk(baseDir, 0, '');
  return files.join('\n');
}

async function extractIntentWithLLM(
  title: string,
  body: string,
  config?: AgentConfig
): Promise<ExtractedIntent | null> {
  if (!config?.model) return null;

  const prompt = `Analyze this bug report and extract the user's intent. The report may be in ANY language - you must understand it regardless of language.

## Bug Report
**Title:** ${title}
**Description:**
${body.slice(0, 3000)}

## Task
Extract the following information. ALWAYS respond in English for code-searchable terms.

Output a JSON object with these fields:
- userAction: What the user was trying to do (in English, e.g., "click capture button", "submit form")
- expectedBehavior: What they expected to happen (in English)
- actualBehavior: What actually happened (in English)
- inferredFeatures: Array of feature/component names that might be involved (in English, use common programming terms like "CaptureButton", "ScreenshotHandler", "onClick handler")
- inferredFileTypes: Array of file types to search (e.g., "button component", "capture utility", "page component", "click handler")
- uiElements: Array of UI elements mentioned or implied (e.g., "button", "form", "modal", "dialog")
- errorPatterns: Array of any error patterns detected, even if vague (e.g., "no response", "silent failure", "nothing happens")
- pageContext: The page/route context if mentioned (e.g., "/shortform", "/settings")
- confidence: Your confidence in this extraction (0-100)

IMPORTANT:
- Translate non-English descriptions to understand intent
- Convert user's terms to likely code equivalents (e.g., "캡쳐버튼" -> "CaptureButton", "capture button")
- Be creative in inferring what code components might be involved
- Output ONLY valid JSON, no markdown`;

  try {
    const { text } = await generateText({
      model: config.model,
      prompt,
      maxOutputTokens: 1000,
      temperature: 0.2,
    });

    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleanText) as ExtractedIntent;
  } catch (error) {
    console.log(`   ⚠️ Intent extraction failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

async function inferFilesWithLLM(
  intent: ExtractedIntent,
  fileTree: string,
  config?: AgentConfig
): Promise<InferredFile[]> {
  if (!config?.model) return [];

  const prompt = `Given this extracted intent and project file structure, identify the most relevant files to investigate.

## User Intent
- Action: ${intent.userAction}
- Expected: ${intent.expectedBehavior}
- Actual: ${intent.actualBehavior}
- Inferred Features: ${intent.inferredFeatures.join(', ')}
- Inferred File Types: ${intent.inferredFileTypes.join(', ')}
- UI Elements: ${intent.uiElements.join(', ')}
- Page Context: ${intent.pageContext || 'unknown'}

## Project Files
${fileTree}

## Task
Identify files that are most likely related to this bug. Consider:
1. Files matching inferred feature names (e.g., "Capture" in name for capture-related bugs)
2. Files in directories matching the page context (e.g., /shortform/ for shortform page bugs)
3. Component files for mentioned UI elements (e.g., Button.tsx for button issues)
4. Handler/hook files for the functionality (e.g., useCapture.ts, handleClick.ts)
5. Page files for route-related issues

Output a JSON array of objects with:
- path: The file path from the list above
- reason: Why this file is relevant (brief)
- relevanceScore: 0-100 score

Return top 15 most relevant files, ordered by relevanceScore descending.
Output ONLY valid JSON array, no markdown.`;

  try {
    const { text } = await generateText({
      model: config.model,
      prompt,
      maxOutputTokens: 1500,
      temperature: 0.2,
    });

    let cleanText = text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    return JSON.parse(cleanText) as InferredFile[];
  } catch (error) {
    console.log(`   ⚠️ File inference failed: ${error instanceof Error ? error.message : 'unknown'}`);
    return [];
  }
}

function mergeInferredWithDiscovered(
  inferredFiles: InferredFile[],
  discoveredFiles: FileInfo[],
  baseDir: string
): FileInfo[] {
  const fileMap = new Map<string, FileInfo>();

  for (const file of discoveredFiles) {
    fileMap.set(file.path, file);
  }

  for (const inferred of inferredFiles) {
    const fullPath = path.join(baseDir, inferred.path);
    const existing = fileMap.get(fullPath);

    if (existing) {
      existing.relevanceScore += inferred.relevanceScore;
      existing.matchedKeywords.push(`llm-inferred:${inferred.reason.slice(0, 30)}`);
    } else {
      try {
        const stats = fs.statSync(fullPath);
        fileMap.set(fullPath, {
          path: fullPath,
          size: stats.size,
          relevanceScore: inferred.relevanceScore * 2,
          pathScore: 0,
          contentScore: 0,
          matchedKeywords: [`llm-inferred:${inferred.reason.slice(0, 30)}`],
        });
      } catch {
        // file doesn't exist, skip
      }
    }
  }

  return Array.from(fileMap.values()).sort((a, b) => b.relevanceScore - a.relevanceScore);
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
      maxOutputTokens: 1000,
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
  description: 'Intent-first file discovery with LLM-powered semantic search',
  requiredLevel: 1,

  async execute(input: FinderInput, config?: AgentConfig): Promise<FinderOutput> {
    const startTime = Date.now();

    try {
      const { issueContext, level, baseDir, maxFiles } = input;

      console.log(`\n🔍 Finder Agent (Level ${level}) - Intent-First Mode`);

      let extractedIntent: ExtractedIntent | null = null;
      let inferredFiles: InferredFile[] = [];

      if (config?.model) {
        console.log('   🧠 Step 1: Extracting user intent with LLM...');
        extractedIntent = await extractIntentWithLLM(
          issueContext.title,
          issueContext.body,
          config
        );

        if (extractedIntent) {
          console.log(`   ✅ Intent extracted (confidence: ${extractedIntent.confidence}%)`);
          console.log(`      Action: ${extractedIntent.userAction}`);
          console.log(`      Features: ${extractedIntent.inferredFeatures.slice(0, 5).join(', ')}`);

          console.log('   🗂️  Step 2: LLM-based file inference...');
          const fileTree = getProjectFileTree(baseDir);
          inferredFiles = await inferFilesWithLLM(extractedIntent, fileTree, config);
          console.log(`   ✅ Inferred ${inferredFiles.length} relevant files`);
        }
      }

      console.log('   📂 Step 3: Pattern-based file discovery (fallback/complement)...');
      const allKeywords = extractedIntent
        ? [...issueContext.keywords, ...extractedIntent.inferredFeatures, ...extractedIntent.uiElements]
        : issueContext.keywords;

      let relevantFiles = findRelevantFiles(
        baseDir,
        allKeywords,
        issueContext.errorLocations,
        issueContext.errorMessages,
        undefined,
        undefined,
        maxFiles
      );
      console.log(`   Found ${relevantFiles.length} files via pattern matching`);

      if (inferredFiles.length > 0) {
        console.log('   🔀 Step 4: Merging LLM-inferred with pattern-discovered files...');
        relevantFiles = mergeInferredWithDiscovered(inferredFiles, relevantFiles, baseDir);
        console.log(`   Merged total: ${relevantFiles.length} unique files`);
      }

      console.log('   🔗 Step 5: Building import graph...');
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

      if (config?.model && !extractedIntent) {
        console.log('   🎯 Step 6: LLM re-ranking (fallback)...');
        relevantFiles = await rerankFilesWithLLM(
          relevantFiles,
          issueContext.title,
          issueContext.body,
          config
        );
      }

      console.log('   📦 Step 7: Extracting code chunks...');
      const contextKeywords = extractedIntent
        ? [...issueContext.keywords, ...extractedIntent.inferredFeatures]
        : issueContext.keywords;

      const chunkedContext = buildChunkedContext(
        relevantFiles,
        issueContext.errorLocations,
        contextKeywords
      );

      const codeChunks: CodeChunk[] = [];
      for (const file of relevantFiles.slice(0, 10)) {
        const chunks = getRelevantChunks(file.path, issueContext.errorLocations, contextKeywords);
        codeChunks.push(...chunks);
      }

      let codeContext: string;
      if (chunkedContext.length > 500) {
        codeContext = chunkedContext;
        console.log(`   ✅ Extracted ${codeChunks.length} relevant code chunks`);
      } else {
        console.log('   ⚠️ Insufficient chunks, falling back to line-based context');
        codeContext = buildCodeContext(relevantFiles, issueContext.errorLocations);
      }

      let callGraph: Map<string, CallGraphNode> | undefined;
      if (level === 2) {
        console.log('   📊 Step 8: Building call graph (L2)...');
        callGraph = buildCallGraph(codeChunks);
        console.log(`   Built call graph with ${callGraph.size} nodes`);

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
          extractedIntent: extractedIntent ?? undefined,
          inferredFiles: inferredFiles.length > 0 ? inferredFiles : undefined,
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

export {
  extractIntentWithLLM,
  inferFilesWithLLM,
  getProjectFileTree,
  mergeInferredWithDiscovered,
};

export default finderAgent;
