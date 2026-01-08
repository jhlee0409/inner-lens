/**
 * Pipeline Adapter Module
 *
 * Converts between the P5 multi-agent orchestrator output
 * and the legacy analyze-issue.ts format.
 *
 * This enables gradual migration from the legacy monolithic flow
 * to the cleaner multi-agent architecture.
 */

import type { LanguageModel } from 'ai';
import type { OrchestratorResult, IssueContext, OrchestratorConfig } from '../agents/types.js';
import type { OutputLanguage } from './i18n.js';
import { runAnalysis, buildIssueContext } from '../agents/orchestrator.js';
import type { ParsedBugReport } from './issue-parser.js';
import { analyzeCorrelation, type CorrelationResult } from './error-correlation.js';

// ============================================
// Types for Legacy Compatibility
// ============================================

/**
 * Legacy AnalysisResult structure used by analyze-issue.ts
 * Compatible with the Zod schema RootCauseAnalysisSchema
 */
export interface LegacyRootCauseAnalysis {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  category: 'runtime_error' | 'logic_error' | 'performance' | 'security' | 'ui_ux' | 'configuration' | 'invalid_report' | 'unknown';
  codeVerification: {
    bugExistsInCode: boolean;
    evidence: string;
    alternativeExplanation?: string;
  };
  rootCause: {
    summary: string;
    explanation: string;
    affectedFiles: string[];
  };
  suggestedFix: {
    steps: string[];
    codeChanges: Array<{
      file: string;
      description: string;
      before?: string;
      after: string;
    }>;
  };
  prevention: string[];
  confidence: number;
  additionalContext?: string;
}

export interface LegacyAnalysisResult {
  isValidReport: boolean;
  invalidReason?: string;
  reportType: 'bug' | 'not_a_bug' | 'feature_request' | 'improvement' | 'cannot_verify' | 'needs_info';
  analyses: LegacyRootCauseAnalysis[];
}

// ============================================
// Pipeline Configuration
// ============================================

export type PipelineMode = 'legacy' | 'p5';

export interface PipelineConfig {
  mode: PipelineMode;
  // Model configuration
  model: LanguageModel;
  // Analysis settings
  maxFiles: number;
  maxTokens: number;
  // Language
  language: OutputLanguage;
  // Verbose logging
  verbose?: boolean;
}

// ============================================
// Adapter Functions
// ============================================

/**
 * Convert P5 AnalysisResult to Legacy format
 * The P5 system uses a simpler AnalysisResult, we need to wrap it
 */
export function convertP5ToLegacy(result: OrchestratorResult): LegacyAnalysisResult {
  const analysis = result.analysis;

  // Determine report type based on category and validity
  let reportType: LegacyAnalysisResult['reportType'] = 'bug';
  if (!analysis.isValidReport) {
    reportType = 'needs_info';
  } else if (analysis.category === 'invalid_report') {
    reportType = 'not_a_bug';
  } else if (analysis.category === 'unknown' && analysis.confidence < 50) {
    reportType = 'cannot_verify';
  }

  // Build the legacy root cause analysis structure
  const legacyAnalysis: LegacyRootCauseAnalysis = {
    severity: analysis.severity,
    category: analysis.category,
    codeVerification: {
      bugExistsInCode: analysis.isValidReport && analysis.confidence >= 70,
      evidence: analysis.rootCause.evidenceChain?.join('\n') || analysis.rootCause.explanation,
      alternativeExplanation: analysis.additionalContext,
    },
    rootCause: {
      summary: analysis.rootCause.summary,
      explanation: analysis.rootCause.explanation,
      affectedFiles: analysis.rootCause.affectedFiles,
    },
    suggestedFix: {
      steps: analysis.suggestedFix.steps,
      codeChanges: analysis.suggestedFix.codeChanges.map(change => ({
        file: change.file,
        description: change.description,
        before: change.before,
        after: change.after,
      })),
    },
    prevention: analysis.prevention,
    confidence: analysis.confidence,
    additionalContext: buildAdditionalContext(result),
  };

  return {
    isValidReport: analysis.isValidReport,
    invalidReason: analysis.isValidReport ? undefined : 'Insufficient information for analysis',
    reportType,
    analyses: [legacyAnalysis],
  };
}

/**
 * Build additional context from orchestrator metadata
 */
function buildAdditionalContext(result: OrchestratorResult): string {
  const parts: string[] = [];

  // Add analysis level info
  parts.push(`📊 **Analysis Level:** ${result.level === 1 ? 'Fast (L1)' : 'Thorough (L2)'}`);
  parts.push(`⏱️ **Total Duration:** ${result.totalDuration}ms`);

  // Add agent pipeline info
  const agents = Object.entries(result.agentResults)
    .filter(([, v]) => v !== undefined)
    .map(([name, output]) => `${name}: ${output?.duration}ms`);
  parts.push(`🤖 **Agents Used:** ${agents.join(' → ')}`);

  // Add reviewer notes if available
  if (result.agentResults.reviewer?.success) {
    const review = result.agentResults.reviewer.data.review;
    if (review.issues.length > 0) {
      parts.push(`\n⚠️ **Reviewer Issues:**\n${review.issues.map(i => `- ${i}`).join('\n')}`);
    }
    if (review.suggestions.length > 0) {
      parts.push(`\n💡 **Reviewer Suggestions:**\n${review.suggestions.map(s => `- ${s}`).join('\n')}`);
    }
  }

  // Add investigator hypotheses if available
  if (result.agentResults.investigator?.success) {
    const hypotheses = result.agentResults.investigator.data.hypotheses;
    if (hypotheses.length > 1) {
      const alternatives = hypotheses.slice(1).map(h => `- [${h.likelihood}%] ${h.summary}`);
      parts.push(`\n🔍 **Alternative Hypotheses:**\n${alternatives.join('\n')}`);
    }
  }

  return parts.join('\n');
}

/**
 * Run analysis using the P5 multi-agent pipeline
 */
export async function runP5Analysis(
  title: string,
  body: string,
  issueNumber: number,
  owner: string,
  repo: string,
  config: PipelineConfig,
  parsedReport?: ParsedBugReport
): Promise<{ result: LegacyAnalysisResult; orchestratorResult: OrchestratorResult }> {
  // Build issue context
  const issueContext = buildIssueContext(title, body, issueNumber, owner, repo);

  // Attach parsed report if available
  if (parsedReport) {
    issueContext.parsedReport = parsedReport;

    // Add error correlation
    const correlation = analyzeCorrelation(parsedReport);
    issueContext.correlationResult = correlation;

    if (config.verbose) {
      console.log(`   📊 Error correlation: ${correlation.correlatedErrors.length} errors correlated`);
      if (correlation.correlatedErrors[0]?.triggerAction) {
        console.log(`   🎯 Likely trigger: ${correlation.correlatedErrors[0].triggerAction.action} on ${correlation.correlatedErrors[0].triggerAction.target}`);
      }
    }
  }

  // Build orchestrator config
  const orchestratorConfig: OrchestratorConfig = {
    finderModel: config.model,
    investigatorModel: config.model,
    explainerModel: config.model,
    reviewerModel: config.model,
    analysisLevel: 'auto',
    enableReviewer: true,
  };

  // Run the multi-agent pipeline
  const orchestratorResult = await runAnalysis({
    issueContext,
    baseDir: '.',
    maxFiles: config.maxFiles,
    config: orchestratorConfig,
  });

  // Convert to legacy format
  const legacyResult = convertP5ToLegacy(orchestratorResult);

  return { result: legacyResult, orchestratorResult };
}

/**
 * Get the pipeline mode from environment
 * Default: 'p5' (multi-agent pipeline)
 * Set ANALYSIS_PIPELINE=legacy to use legacy single-model flow
 */
export function getPipelineMode(): PipelineMode {
  return 'p5';
}
