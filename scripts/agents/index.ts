/**
 * Multi-Agent Architecture for Bug Analysis (P5)
 *
 * Exports all agent types and the orchestrator for multi-agent analysis.
 *
 * Usage:
 * ```typescript
 * import { runAnalysis, buildIssueContext } from './agents/index.js';
 *
 * const context = buildIssueContext(title, body, issueNumber, owner, repo);
 * const result = await runAnalysis({ issueContext: context });
 * console.log(result.analysis);
 * ```
 */

// Type exports
export type {
  // Issue context types
  ErrorLocation,
  FileInfo,
  CodeChunk,
  CallGraphNode,
  IssueContext,

  // Analysis level types
  AnalysisLevel,
  LevelCriteria,

  // Agent base types
  AgentInput,
  AgentOutput,
  AgentConfig,
  Agent,

  // Finder types
  FinderInput,
  FinderOutput,

  // Investigator types
  Hypothesis,
  InvestigatorInput,
  InvestigatorOutput,

  // Explainer types
  AnalysisResult,
  ExplainerInput,
  ExplainerOutput,

  // Reviewer types
  ReviewResult,
  ReviewerInput,
  ReviewerOutput,

  // Orchestrator types
  OrchestratorConfig,
  OrchestratorResult,
} from './types.js';

// Schema exports
export { AnalysisResultSchema } from './types.js';

// Agent exports
export { finderAgent } from './finder.js';

// Orchestrator exports
export {
  runAnalysis,
  determineLevel,
  buildIssueContext,
  extractKeywords,
  extractErrorLocations,
  extractErrorMessages,
} from './orchestrator.js';

// Default export for convenience
export { default as orchestrator } from './orchestrator.js';
