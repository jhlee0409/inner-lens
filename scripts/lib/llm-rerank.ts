/**
 * LLM Re-ranking Module
 *
 * Uses LLM to re-rank file candidates based on relevance to bug reports.
 * Uses fast/cheap models to minimize cost and latency.
 */

import * as fs from 'fs';

import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';

import type { FileInfo } from './file-discovery';

// ============================================
// Types
// ============================================

export type AIProvider = 'anthropic' | 'openai' | 'google';

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

// ============================================
// File Summary Extraction
// ============================================

/**
 * Extract a summary of a file for LLM context
 * Prioritizes exports, function signatures, and imports
 */
export function extractFileSummary(filePath: string, maxChars = 800): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract imports and exports first (useful context)
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

    // Build summary prioritizing structure
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

// ============================================
// LLM Re-ranking
// ============================================

/**
 * Use LLM to re-rank file candidates based on relevance to the bug report
 * Uses a fast/cheap model to minimize cost and latency
 */
export async function rerankFilesWithLLM(
  files: FileInfo[],
  issueTitle: string,
  issueBody: string,
  provider: AIProvider = 'anthropic',
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
${candidates
  .map(
    (c, i) => `
### [${i + 1}] ${c.path}
\`\`\`
${c.summary}
\`\`\`
`
  )
  .join('\n')}

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
    switch (provider) {
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
    } catch {
      console.log('   ⚠️ Could not parse LLM re-ranking response, using original order');
      return files;
    }

    if (!Array.isArray(rerankResults) || rerankResults.length === 0) {
      return files;
    }

    // Create a map of path -> new score
    const scoreMap = new Map<string, number>();
    for (const result of rerankResults) {
      if (result.path && typeof result.newScore === 'number') {
        // Normalize LLM score (0-100) to our scale
        scoreMap.set(result.path, result.newScore * 2); // Scale to ~0-200 range
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
