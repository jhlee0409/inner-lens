/**
 * Multi-Agent Architecture Types (P5)
 *
 * 2-Level Adaptive Pipeline:
 * - Level 1 (Fast): Finder → Explainer (1 LLM call)
 * - Level 2 (Thorough): Finder → Investigator → Explainer → Reviewer (3 LLM calls)
 *
 * Assembly-Line Pattern: Each agent processes and passes results to the next
 */

import type { LanguageModel } from 'ai';
import { z } from 'zod';
import type { ParsedBugReport } from '../lib/issue-parser.js';
import type { CorrelationResult } from '../lib/error-correlation.js';
import type { OutputLanguage } from '../lib/i18n.js';

// ============================================
// Issue Context (Input from GitHub)
// ============================================

/**
 * Parsed error location from stack traces
 */
export interface ErrorLocation {
  file: string;
  line?: number;
  column?: number;
  functionName?: string;
  context?: string;
}

/**
 * Information about a relevant file
 */
export interface FileInfo {
  path: string;
  size: number;
  relevanceScore: number;
  pathScore: number;
  contentScore: number;
  matchedKeywords: string[];
}

/**
 * Code chunk extracted from source files
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
 * Call graph node for function relationships
 */
export interface CallGraphNode {
  name: string;
  calls: string[];
  calledBy: string[];
  isExported: boolean;
  isAsync: boolean;
  lines: { start: number; end: number };
}

export interface IssueContext {
  title: string;
  body: string;
  issueNumber: number;
  owner: string;
  repo: string;
  keywords: string[];
  errorLocations: ErrorLocation[];
  errorMessages: string[];
  parsedReport?: ParsedBugReport;
  correlationResult?: CorrelationResult;
  /** Performance-based category hint (e.g., 'performance', 'ui_ux') */
  categoryHint?: string;
}

// ============================================
// Analysis Levels
// ============================================

export type AnalysisLevel = 1 | 2;

/**
 * Criteria for determining analysis level
 */
export interface LevelCriteria {
  hasStackTrace: boolean;
  hasErrorLogs: boolean;
  descriptionQuality: 'low' | 'medium' | 'high';
  errorComplexity: 'simple' | 'moderate' | 'complex';
}

// ============================================
// Agent Base Types
// ============================================

/**
 * Base input for all agents
 */
export interface AgentInput {
  issueContext: IssueContext;
  level: AnalysisLevel;
  previousResults?: Record<string, unknown>;
}

/**
 * Base output from all agents
 */
export interface AgentOutput {
  agentName: string;
  success: boolean;
  error?: string;
  duration: number; // milliseconds
  data: unknown;
}

/**
 * Agent execution configuration
 */
export interface AgentConfig {
  model?: LanguageModel;
  maxRetries?: number;
  timeout?: number;
  language?: OutputLanguage;
}

/**
 * Base agent interface - all agents must implement this
 */
export interface Agent<TInput extends AgentInput = AgentInput, TOutput extends AgentOutput = AgentOutput> {
  name: string;
  description: string;
  requiredLevel: AnalysisLevel; // Minimum level to run this agent

  execute(input: TInput, config?: AgentConfig): Promise<TOutput>;
}

// ============================================
// Finder Agent Types
// ============================================

export interface ExtractedIntent {
  userAction: string;
  expectedBehavior: string;
  actualBehavior: string;
  inferredFeatures: string[];
  inferredFileTypes: string[];
  uiElements: string[];
  errorPatterns: string[];
  pageContext?: string;
  confidence: number;
}

export interface InferredFile {
  path: string;
  reason: string;
  relevanceScore: number;
}

export interface FinderInput extends AgentInput {
  baseDir: string;
  maxFiles: number;
}

export interface FinderOutput extends AgentOutput {
  agentName: 'finder';
  data: {
    extractedIntent?: ExtractedIntent;
    inferredFiles?: InferredFile[];
    relevantFiles: FileInfo[];
    importGraph: Map<string, string[]>;
    codeChunks: CodeChunk[];
    callGraph?: Map<string, CallGraphNode>;
    codeContext: string;
  };
}

// ============================================
// Investigator Agent Types (L2 only)
// ============================================

export interface Hypothesis {
  id: string;
  summary: string;
  explanation: string;
  likelihood: number; // 0-100
  supportingEvidence: string[];
  contraEvidence: string[];
}

export interface InvestigatorInput extends AgentInput {
  finderOutput: FinderOutput;
}

export interface InvestigatorOutput extends AgentOutput {
  agentName: 'investigator';
  data: {
    hypotheses: Hypothesis[];
    primaryHypothesis: string; // hypothesis id
    additionalContext: string;
  };
}

// ============================================
// Explainer Agent Types
// ============================================

/**
 * Structured analysis result schema
 */
export const AnalysisResultSchema = z.object({
  isValidReport: z.boolean().describe('Whether this is a valid, actionable bug report'),
  invalidReason: z.string().optional().describe('If invalid, explain why'),

  severity: z.enum(['critical', 'high', 'medium', 'low', 'none']),
  category: z.enum([
    'runtime_error',
    'logic_error',
    'performance',
    'security',
    'ui_ux',
    'configuration',
    'invalid_report',
    'unknown',
  ]),

  rootCause: z.object({
    summary: z.string().describe('One-line summary of the root cause'),
    explanation: z.string().describe('Detailed explanation with code references'),
    affectedFiles: z.array(z.string()).describe('Files likely causing the issue'),
    evidenceChain: z.array(z.string()).optional().describe('Evidence chain: error → call path → root cause'),
  }),

  suggestedFix: z.object({
    steps: z.array(z.string()).describe('Step-by-step fix instructions'),
    codeChanges: z.array(
      z.object({
        file: z.string(),
        line: z.number().optional(),
        description: z.string(),
        before: z.string().optional(),
        after: z.string(),
      })
    ).describe('Specific code changes'),
  }),

  prevention: z.array(z.string()).describe('How to prevent similar issues'),
  confidence: z.number().min(0).max(100).describe('Confidence level (0-100)'),
  additionalContext: z.string().optional().describe('Additional notes or caveats'),
  selfValidation: z.object({
    counterEvidence: z.array(z.string()).describe('What evidence would DISPROVE this hypothesis?'),
    assumptions: z.array(z.string()).describe('What assumptions are you making that might be wrong?'),
    confidenceJustification: z.string().describe('Why did you choose this confidence level? Cite specific evidence.'),
    alternativeHypotheses: z.array(z.string()).optional().describe('Other explanations considered and rejected'),
  }).optional().describe('Self-validation to prevent overconfident or hallucinated conclusions'),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export interface ExplainerInput extends AgentInput {
  finderOutput: FinderOutput;
  investigatorOutput?: InvestigatorOutput; // L2 only
}

export interface ExplainerOutput extends AgentOutput {
  agentName: 'explainer';
  data: {
    analysis: AnalysisResult;
  };
}

// ============================================
// Reviewer Agent Types (L2 only)
// ============================================

export interface ReviewResult {
  approved: boolean;
  confidenceAdjustment: number;
  issues: string[];
  suggestions: string[];
  verifiedClaims?: string[];
  counterEvidence?: string[];
}

export interface ReviewerInput extends AgentInput {
  finderOutput: FinderOutput;
  explainerOutput: ExplainerOutput;
  investigatorOutput?: InvestigatorOutput;
}

export interface ReviewerOutput extends AgentOutput {
  agentName: 'reviewer';
  data: {
    review: ReviewResult;
    finalAnalysis: AnalysisResult; // Adjusted based on review
  };
}

// ============================================
// Orchestrator Types
// ============================================

export interface OrchestratorConfig {
  // Model selection per agent
  finderModel?: LanguageModel;
  investigatorModel?: LanguageModel;
  explainerModel?: LanguageModel;
  reviewerModel?: LanguageModel;

  // Behavior settings
  analysisLevel?: 'auto' | 1 | 2;
  enableReviewer?: boolean;
  maxRetries?: number;

  // Output language for analysis
  language?: OutputLanguage;
}

export interface OrchestratorResult {
  level: AnalysisLevel;
  analysis: AnalysisResult;
  agentResults: {
    finder: FinderOutput;
    investigator?: InvestigatorOutput;
    explainer: ExplainerOutput;
    reviewer?: ReviewerOutput;
  };
  totalDuration: number;
}
