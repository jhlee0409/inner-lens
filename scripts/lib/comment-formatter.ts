/**
 * Comment Formatter Module
 *
 * Formats GitHub issue comments for AI analysis results.
 * Supports multiple output languages via i18n.
 */

import { getI18n } from './i18n';
import type { OutputLanguage } from './i18n';
import type { AIProvider } from './llm-rerank';

// ============================================
// Types
// ============================================

export interface FormatOptions {
  provider: string;
  model: string;
  filesAnalyzed: number;
  analysisIndex?: number; // 1-based index for multiple analyses
  totalAnalyses?: number; // Total number of analyses
  language: OutputLanguage; // Output language for i18n
}

/**
 * Minimal interface for RootCauseAnalysis needed for formatting
 * Compatible with Zod-inferred RootCauseAnalysis type
 */
export interface RootCauseAnalysisForFormat {
  confidence: number;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  category: string;
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
  additionalContext?: string;
  codeVerification: {
    bugExistsInCode: boolean;
    evidence: string;
    alternativeExplanation?: string;
  };
}

export type ReportType =
  | 'bug'
  | 'not_a_bug'
  | 'feature_request'
  | 'improvement'
  | 'cannot_verify'
  | 'needs_info';

// ============================================
// Constants
// ============================================

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4.1',
  google: 'gemini-2.0-flash',
};

// ============================================
// Formatting Functions
// ============================================

/**
 * Format comment for invalid/insufficient reports
 */
export function formatInvalidReportComment(
  invalidReason: string | undefined,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';
  const t = getI18n(options.language);

  return `## 🔍 ${t.analysisTitle}

⚪ **${t.reportStatus}:** ${t.insufficientInfo}

---

### ❓ ${t.unableToAnalyze}

${t.insufficientInfoReason}

**Reason:** ${invalidReason || t.insufficientInfoReason}

---

### 📝 ${t.whatWeNeed}

1. **${t.errorMessages}**
2. **${t.stepsToReproduce}**
3. **${t.expectedVsActual}**
4. **${t.consoleLogs}**

---

### 🔄 ${t.nextSteps}

- ${t.updateIssue}
- ${t.submitNewReport}

---

<details>
<summary>${t.analysisMetadata}</summary>

| Field | Value |
|-------|-------|
| Status | ${t.insufficientInfo} |
| ${t.provider} | ${options.provider} |
| ${t.model} | ${modelDisplay} |
| ${t.filesAnalyzed} | ${options.filesAnalyzed} |
| ${t.timestamp} | ${new Date().toISOString()} |

</details>

*${t.generatedBy} [inner-lens](https://github.com/jhlee0409/inner-lens).*`;
}

/**
 * Format comment for non-bug reports (feature requests, not a bug, etc.)
 */
export function formatNonBugReportComment(
  reportType: ReportType,
  analysis: RootCauseAnalysisForFormat,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';
  const t = getI18n(options.language);

  const reportTypeLabels: Record<string, { emoji: string; label: string }> = {
    bug: { emoji: '🐛', label: t.confirmedBug },
    not_a_bug: { emoji: '✅', label: t.notABug },
    feature_request: { emoji: '💡', label: t.featureRequest },
    improvement: { emoji: '🔧', label: t.improvementSuggestion },
    cannot_verify: { emoji: '🔍', label: t.cannotVerify },
    needs_info: { emoji: '❓', label: t.needsMoreInfo },
  };

  const reportTypeInfo = reportTypeLabels[reportType] || reportTypeLabels.cannot_verify;

  return `## 🔍 ${t.analysisTitle}

${reportTypeInfo.emoji} **${t.classification}:** ${reportTypeInfo.label}

---

### 📋 ${t.analysisResult}

${
  analysis.codeVerification?.bugExistsInCode === false
    ? `**${t.codeVerification}:** ❌ ${t.noBugFound}

${analysis.codeVerification.evidence}

${analysis.codeVerification.alternativeExplanation ? `**${t.possibleExplanation}:** ${analysis.codeVerification.alternativeExplanation}` : ''}`
    : `${analysis.rootCause.explanation}`
}

---

${
  reportType === 'feature_request' || reportType === 'improvement'
    ? `### 💡 ${t.recommendation}

${t.featureRequestNote}
`
    : ''
}

${
  reportType === 'not_a_bug'
    ? `### ✅ ${t.expectedBehavior}

${t.workingAsDesigned}

${analysis.codeVerification?.alternativeExplanation || ''}
`
    : ''
}

${
  reportType === 'cannot_verify'
    ? `### 🔍 ${t.unableToConfirm}

**${t.whatThisMeans}:**
- ${t.bugMayExist}
- ${t.environmentSpecific}
- ${t.moreInfoNeeded}

**${t.suggestedNextSteps}:**
1. ${t.provideConsoleLogs}
2. ${t.shareStepsToReproduce}
3. ${t.includeExactError}
`
    : ''
}

---

<details>
<summary>${t.analysisMetadata}</summary>

| Field | Value |
|-------|-------|
| ${t.classification} | ${reportTypeInfo.label} |
| ${t.bugFoundInCode} | ${analysis.codeVerification?.bugExistsInCode ? t.yes : t.no} |
| ${t.confidence} | ${analysis.confidence}% |
| ${t.provider} | ${options.provider} |
| ${t.model} | ${modelDisplay} |
| ${t.filesAnalyzed} | ${options.filesAnalyzed} |
| ${t.timestamp} | ${new Date().toISOString()} |

</details>

*${t.generatedBy} [inner-lens](https://github.com/jhlee0409/inner-lens). ${t.verifyBeforeApplying}*`;
}

/**
 * Format comment for a single root cause analysis (bug report)
 */
export function formatRootCauseComment(
  analysis: RootCauseAnalysisForFormat,
  options: FormatOptions
): string {
  const modelDisplay = options.model || DEFAULT_MODELS[options.provider as AIProvider] || 'default';
  const t = getI18n(options.language);

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    none: '⚪',
  };

  const categoryLabels: Record<string, string> = {
    runtime_error: t.runtimeError,
    logic_error: t.logicError,
    performance: t.performanceIssue,
    security: t.securityIssue,
    ui_ux: t.uiUxIssue,
    configuration: t.configurationIssue,
    invalid_report: t.invalidReport,
    unknown: t.unknown,
  };

  const codeChangesSection = analysis.suggestedFix.codeChanges
    .map(change => {
      let section = `#### 📄 \`${change.file}\`\n${change.description}\n`;
      if (change.before) {
        section += `\n**${t.before}:**\n\`\`\`\n${change.before}\n\`\`\`\n`;
      }
      section += `\n**${t.after}:**\n\`\`\`\n${change.after}\n\`\`\``;
      return section;
    })
    .join('\n\n');

  // Show analysis number if there are multiple analyses
  const analysisHeader =
    options.totalAnalyses && options.totalAnalyses > 1
      ? `## 🔍 ${t.analysisTitle} (${options.analysisIndex}/${options.totalAnalyses})`
      : `## 🔍 ${t.analysisTitle}`;

  return `${analysisHeader}

${severityEmoji[analysis.severity]} **${t.severity}:** ${analysis.severity.toUpperCase()} | **${t.category}:** ${categoryLabels[analysis.category]} | **${t.confidence}:** ${analysis.confidence}%

---

### 🎯 ${t.rootCause}

**${analysis.rootCause.summary}**

${analysis.rootCause.explanation}

${analysis.rootCause.affectedFiles.length > 0 ? `**${t.affectedFiles}:** ${analysis.rootCause.affectedFiles.map(f => `\`${f}\``).join(', ')}` : ''}

---

### 🔧 ${t.suggestedFix}

${analysis.suggestedFix.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${codeChangesSection ? `\n#### ${t.codeChanges}\n\n${codeChangesSection}` : ''}

---

### 🛡️ ${t.prevention}

${analysis.prevention.map(p => `- ${p}`).join('\n')}

${analysis.additionalContext ? `\n---\n\n### 📝 ${t.additionalNotes}\n\n${analysis.additionalContext}` : ''}

---

<details>
<summary>${t.analysisMetadata}</summary>

| Field | Value |
|-------|-------|
| ${t.provider} | ${options.provider} |
| ${t.model} | ${modelDisplay} |
| ${t.filesAnalyzed} | ${options.filesAnalyzed} |
| ${t.timestamp} | ${new Date().toISOString()} |
| ${t.confidence} | ${analysis.confidence}% |
${options.totalAnalyses && options.totalAnalyses > 1 ? `| ${t.analysis} | ${options.analysisIndex} / ${options.totalAnalyses} |` : ''}

</details>

*${t.generatedBy} [inner-lens](https://github.com/jhlee0409/inner-lens). ${t.verifyBeforeApplying}*`;
}
