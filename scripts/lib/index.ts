/**
 * Library Index
 *
 * Re-exports all modules from the lib directory.
 */

// i18n - Internationalization
export {
  type OutputLanguage,
  type I18nStrings,
  LANGUAGE_NAMES,
  I18N,
  getI18n,
  getOutputLanguage,
} from './i18n';

// File Discovery
export {
  type FileInfo,
  type ErrorLocation,
  type SearchContext,
  type ImportInfo,
  extractErrorLocations,
  extractErrorMessages,
  extractKeywords,
  searchFileContent,
  calculatePathRelevance,
  findRelevantFiles,
  parseImports,
  resolveImportPath,
  buildImportGraph,
  expandFilesWithImports,
} from './file-discovery';

// Code Chunking
export {
  type CodeChunk,
  extractCodeChunks,
  getRelevantChunks,
  readFileWithContext,
  readFileWithLineContext,
  buildChunkedContext,
  buildCodeContext,
} from './code-chunking';

// Confidence Calibration
export {
  type FileRole,
  type AnalysisForCalibration,
  type AnalysisResultForCalibration,
  type ConfidenceCalibrationResult,
  classifyFileRole,
  isRoleAppropriateForCategory,
  calibrateConfidence,
  calibrateAllAnalyses,
} from './confidence';

// LLM Re-ranking
export {
  type AIProvider,
  extractFileSummary,
  rerankFilesWithLLM,
} from './llm-rerank';

// Comment Formatting
export {
  type FormatOptions,
  type RootCauseAnalysisForFormat,
  type ReportType,
  DEFAULT_MODELS,
  formatInvalidReportComment,
  formatNonBugReportComment,
  formatRootCauseComment,
} from './comment-formatter';

// Hallucination Check
export {
  type HallucinationCheckResult,
  type HallucinationCheck,
  type AnalysisToVerify,
  type VerificationContext,
  verifyFileExistence,
  verifyCodeCitations,
  verifyLineReferences,
  verifySymbolReferences,
  checkForHallucinations,
  applyHallucinationPenalty,
  formatHallucinationReport,
} from './hallucination-check';
