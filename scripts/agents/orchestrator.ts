/**
 * Multi-Agent Orchestrator (P5 Phase 1)
 *
 * Coordinates the agent pipeline based on analysis level:
 * - Level 1 (Fast): Finder → Explainer (1 LLM call)
 * - Level 2 (Thorough): Finder → Investigator → Explainer → Reviewer (3 LLM calls)
 *
 * Assembly-Line Pattern: Each agent processes and passes results to the next
 */

import * as path from 'path';

import type {
  IssueContext,
  AnalysisLevel,
  LevelCriteria,
  OrchestratorConfig,
  OrchestratorResult,
  FinderOutput,
  ExplainerOutput,
  InvestigatorOutput,
  ReviewerOutput,
  AnalysisResult,
} from './types.js';

import { finderAgent } from './finder.js';
import { explainerAgent } from './explainer.js';
import { investigatorAgent } from './investigator.js';
import { reviewerAgent } from './reviewer.js';

// ============================================
// Level Determination (Stub for Phase 3)
// ============================================

/**
 * Analyze issue context to determine analysis level
 * Returns Level 1 for simple bugs, Level 2 for complex ones
 */
export function determineLevel(context: IssueContext, forceLevel?: 'auto' | 1 | 2): AnalysisLevel {
  // If user forces a level, use it
  if (forceLevel === 1 || forceLevel === 2) {
    return forceLevel;
  }

  const criteria = extractLevelCriteria(context);

  // Level 2 criteria:
  // - No stack trace AND low description quality
  // - Complex error patterns
  // - Multiple error locations

  let l2Score = 0;

  if (!criteria.hasStackTrace) l2Score += 1;
  if (!criteria.hasErrorLogs) l2Score += 1;
  if (criteria.descriptionQuality === 'low') l2Score += 2;
  if (criteria.errorComplexity === 'complex') l2Score += 2;

  // Need thorough analysis for complex cases
  return l2Score >= 3 ? 2 : 1;
}

/**
 * Extract criteria for level determination
 */
function extractLevelCriteria(context: IssueContext): LevelCriteria {
  const hasStackTrace = context.errorLocations.length > 0;
  const hasErrorLogs = context.errorMessages.length > 0;

  // Description quality heuristics
  const bodyLength = context.body.length;
  const hasCodeBlock = context.body.includes('```');
  const hasSteps = /\d+\.\s+/.test(context.body) || /step/i.test(context.body);

  let descriptionQuality: 'low' | 'medium' | 'high' = 'low';
  if (bodyLength > 500 && (hasCodeBlock || hasSteps)) {
    descriptionQuality = 'high';
  } else if (bodyLength > 200 || hasCodeBlock) {
    descriptionQuality = 'medium';
  }

  // Error complexity heuristics
  let errorComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
  if (context.errorLocations.length > 5) {
    errorComplexity = 'complex';
  } else if (context.errorLocations.length > 2 || context.errorMessages.length > 2) {
    errorComplexity = 'moderate';
  }

  return {
    hasStackTrace,
    hasErrorLogs,
    descriptionQuality,
    errorComplexity,
  };
}

// ============================================
// Placeholder Agents (To be implemented in Phase 2-4)
// ============================================

async function runExplainer(
  context: IssueContext,
  finderOutput: FinderOutput,
  level: AnalysisLevel,
  investigatorOutput?: InvestigatorOutput,
  config?: OrchestratorConfig
): Promise<ExplainerOutput> {
  return explainerAgent.execute(
    {
      issueContext: context,
      level,
      finderOutput,
      investigatorOutput,
    },
    { model: config?.explainerModel, language: config?.language }
  );
}

/**
 * Investigator Agent - Generates hypotheses (Phase 3, L2 only)
 * Uses Call Graph and code context to form multiple hypotheses
 */
async function runInvestigator(
  context: IssueContext,
  finderOutput: FinderOutput,
  config?: OrchestratorConfig
): Promise<InvestigatorOutput> {
  return investigatorAgent.execute(
    {
      issueContext: context,
      level: 2,
      finderOutput,
    },
    { model: config?.investigatorModel, language: config?.language }
  );
}

/**
 * Reviewer Agent - Validates analysis (Phase 4, L2 only)
 * Reviews and adjusts confidence based on evidence quality
 */
async function runReviewer(
  context: IssueContext,
  finderOutput: FinderOutput,
  explainerOutput: ExplainerOutput,
  investigatorOutput?: InvestigatorOutput,
  config?: OrchestratorConfig
): Promise<ReviewerOutput> {
  return reviewerAgent.execute(
    {
      issueContext: context,
      level: 2,
      finderOutput,
      explainerOutput,
      investigatorOutput,
    },
    { model: config?.reviewerModel, language: config?.language }
  );
}

// ============================================
// Orchestrator Implementation
// ============================================

export interface RunAnalysisOptions {
  issueContext: IssueContext;
  baseDir?: string;
  maxFiles?: number;
  config?: OrchestratorConfig;
}

/**
 * Main orchestrator function that runs the multi-agent pipeline
 */
export async function runAnalysis(options: RunAnalysisOptions): Promise<OrchestratorResult> {
  const {
    issueContext,
    baseDir = '.',
    maxFiles = 25,
    config = {},
  } = options;

  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════');
  console.log('   🤖 Multi-Agent Analysis Pipeline (P5)');
  console.log('═══════════════════════════════════════════════');

  // Determine analysis level
  const level = determineLevel(issueContext, config.analysisLevel);
  console.log(`\n📊 Analysis Level: ${level} (${level === 1 ? 'Fast' : 'Thorough'})`);

  if (level === 1) {
    console.log('   Pipeline: Finder → Explainer');
  } else {
    console.log('   Pipeline: Finder → Investigator → Explainer → Reviewer');
  }

  // ============================================
  // Step 1: Run Finder Agent
  // ============================================

  const finderOutput = await finderAgent.execute(
    {
      issueContext,
      level,
      baseDir,
      maxFiles,
    },
    { model: config.finderModel }
  );

  if (!finderOutput.success) {
    console.error('❌ Finder Agent failed:', finderOutput.error);
    throw new Error(`Finder Agent failed: ${finderOutput.error}`);
  }

  // ============================================
  // Step 2: Run Investigator Agent (L2 only)
  // ============================================

  let investigatorOutput: InvestigatorOutput | undefined;

  if (level === 2) {
    console.log('\n🧠 Running Investigator Agent (L2)...');
    investigatorOutput = await runInvestigator(issueContext, finderOutput, config);

    if (!investigatorOutput.success) {
      console.warn('⚠️ Investigator failed, continuing without hypotheses');
    } else {
      console.log(`   Generated ${investigatorOutput.data.hypotheses.length} hypotheses`);
    }
  }

  // ============================================
  // Step 3: Run Explainer Agent
  // ============================================

  console.log('\n📝 Running Explainer Agent...');
  const explainerOutput = await runExplainer(
    issueContext,
    finderOutput,
    level,
    investigatorOutput,
    config
  );

  if (!explainerOutput.success) {
    console.error('❌ Explainer Agent failed:', explainerOutput.error);
    throw new Error(`Explainer Agent failed: ${explainerOutput.error}`);
  }

  // ============================================
  // Step 4: Run Reviewer Agent (L2 only, optional)
  // ============================================

  let reviewerOutput: ReviewerOutput | undefined;
  let finalAnalysis = explainerOutput.data.analysis;

  if (level === 2 && config.enableReviewer !== false) {
    console.log('\n✅ Running Reviewer Agent (L2)...');
    reviewerOutput = await runReviewer(
      issueContext,
      finderOutput,
      explainerOutput,
      investigatorOutput,
      config
    );

    if (reviewerOutput.success) {
      finalAnalysis = reviewerOutput.data.finalAnalysis;
      console.log(`   Review: ${reviewerOutput.data.review.approved ? 'Approved' : 'Issues found'}`);
      console.log(`   Confidence adjustment: ${reviewerOutput.data.review.confidenceAdjustment > 0 ? '+' : ''}${reviewerOutput.data.review.confidenceAdjustment}`);
    } else {
      console.warn('⚠️ Reviewer failed, using unreviewed analysis');
    }
  }

  // ============================================
  // Assemble Result
  // ============================================

  const totalDuration = Date.now() - startTime;

  console.log('\n═══════════════════════════════════════════════');
  console.log(`   ✅ Analysis Complete (${totalDuration}ms)`);
  console.log(`   📊 Confidence: ${finalAnalysis.confidence}%`);
  console.log(`   🎯 Category: ${finalAnalysis.category}`);
  console.log('═══════════════════════════════════════════════\n');

  return {
    level,
    analysis: finalAnalysis,
    agentResults: {
      finder: finderOutput,
      investigator: investigatorOutput,
      explainer: explainerOutput,
      reviewer: reviewerOutput,
    },
    totalDuration,
  };
}

// ============================================
// Context Extraction Helpers
// ============================================

/**
 * Extract keywords from issue text
 */
export function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // File paths (tsx/jsx before ts/js)
  const filePathPattern = /(?:[\w-]+\/)*[\w-]+\.(tsx|ts|jsx|js|py|go|rs|java|kt)/g;
  keywords.push(...(text.match(filePathPattern) || []));

  // Error types
  const errorPattern = /(?:Error|Exception|TypeError|ReferenceError|SyntaxError|RuntimeError|NullPointerException)/g;
  keywords.push(...(text.match(errorPattern) || []));

  // Identifiers (PascalCase or camelCase)
  const identifierPattern = /\b[A-Z][a-zA-Z0-9]{2,}\b|\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  keywords.push(...(text.match(identifierPattern) || []).slice(0, 15));

  return [...new Set(keywords)];
}

/**
 * Extract error locations from stack traces
 */
export function extractErrorLocations(text: string): import('./types.js').ErrorLocation[] {
  const locations: import('./types.js').ErrorLocation[] = [];
  const seenFiles = new Set<string>();

  // Node.js/Chrome style
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

  // Firefox style
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

  // Python style
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

  // Generic file:line
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

  return locations;
}

/**
 * Extract error messages from text
 */
export function extractErrorMessages(text: string): string[] {
  const messages: string[] = [];

  const patterns = [
    /(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):\s*(.+?)(?:\n|$)/gi,
    /(?:Uncaught|Unhandled)\s+(?:Error|Exception):\s*(.+?)(?:\n|$)/gi,
    /(?:error|Error|ERROR):\s*(.+?)(?:\n|$)/g,
    /(?:AssertionError|assertion failed):\s*(.+?)(?:\n|$)/gi,
    /(?:NetworkError|FetchError|AxiosError):\s*(.+?)(?:\n|$)/gi,
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

/**
 * Build IssueContext from raw GitHub issue data
 */
export function buildIssueContext(
  title: string,
  body: string,
  issueNumber: number,
  owner: string,
  repo: string
): IssueContext {
  const fullText = `${title} ${body}`;

  return {
    title,
    body,
    issueNumber,
    owner,
    repo,
    keywords: extractKeywords(fullText),
    errorLocations: extractErrorLocations(fullText),
    errorMessages: extractErrorMessages(fullText),
  };
}

export default { runAnalysis, determineLevel, buildIssueContext };
