import type { LanguageModel } from 'ai';
import type { OrchestratorResult, OrchestratorConfig } from '../agents/types.js';
import type { OutputLanguage } from './i18n.js';
import { runAnalysis, buildIssueContext } from '../agents/orchestrator.js';
import type { ParsedBugReport } from './issue-parser.js';
import { analyzeCorrelation } from './error-correlation.js';



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

export function buildAdditionalContext(result: OrchestratorResult): string {
  const parts: string[] = [];

  parts.push(`📊 **Analysis Level:** ${result.level === 1 ? 'Fast (L1)' : 'Thorough (L2)'}`);
  parts.push(`⏱️ **Total Duration:** ${result.totalDuration}ms`);

  const agents = Object.entries(result.agentResults)
    .filter(([, v]) => v !== undefined)
    .map(([name, output]) => `${name}: ${output?.duration}ms`);
  parts.push(`🤖 **Agents Used:** ${agents.join(' → ')}`);

  if (result.agentResults.reviewer?.success) {
    const review = result.agentResults.reviewer.data.review;
    if (review.issues.length > 0) {
      parts.push(`\n⚠️ **Reviewer Issues:**\n${review.issues.map(i => `- ${i}`).join('\n')}`);
    }
    if (review.suggestions.length > 0) {
      parts.push(`\n💡 **Reviewer Suggestions:**\n${review.suggestions.map(s => `- ${s}`).join('\n')}`);
    }
  }

  if (result.agentResults.investigator?.success) {
    const hypotheses = result.agentResults.investigator.data.hypotheses;
    if (hypotheses.length > 1) {
      const alternatives = hypotheses.slice(1).map(h => `- [${h.likelihood}%] ${h.summary}`);
      parts.push(`\n🔍 **Alternative Hypotheses:**\n${alternatives.join('\n')}`);
    }
  }

  return parts.join('\n');
}

export async function runP5Analysis(
  title: string,
  body: string,
  issueNumber: number,
  owner: string,
  repo: string,
  config: PipelineConfig,
  parsedReport?: ParsedBugReport
): Promise<OrchestratorResult> {
  const issueContext = buildIssueContext(title, body, issueNumber, owner, repo);

  if (parsedReport) {
    issueContext.parsedReport = parsedReport;

    const correlation = analyzeCorrelation(parsedReport);
    issueContext.correlationResult = correlation;

    if (config.verbose) {
      console.log(`   📊 Error correlation: ${correlation.correlatedErrors.length} errors correlated`);
      if (correlation.correlatedErrors[0]?.triggerAction) {
        console.log(`   🎯 Likely trigger: ${correlation.correlatedErrors[0].triggerAction.action} on ${correlation.correlatedErrors[0].triggerAction.target}`);
      }
    }
  }

  const orchestratorConfig: OrchestratorConfig = {
    finderModel: config.model,
    investigatorModel: config.model,
    explainerModel: config.model,
    reviewerModel: config.model,
    analysisLevel: 'auto',
    enableReviewer: true,
    language: config.language,
  };

  return runAnalysis({
    issueContext,
    baseDir: '.',
    maxFiles: config.maxFiles,
    config: orchestratorConfig,
  });
}

/**
 * Get the pipeline mode from environment
 * Default: 'p5' (multi-agent pipeline)
 * Set ANALYSIS_PIPELINE=legacy to use legacy single-model flow
 */
export function getPipelineMode(): PipelineMode {
  return 'p5';
}
