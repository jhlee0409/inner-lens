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
import { maskSensitiveData } from '../src/utils/masking.js';
import {
  // i18n
  type OutputLanguage,
  type I18nStrings,
  LANGUAGE_NAMES,
  I18N,
  getI18n,
  getOutputLanguage,
  // File Discovery
  type FileInfo,
  type ErrorLocation,
  type SearchContext,
  extractErrorLocations,
  extractErrorMessages,
  extractKeywords,
  searchFileContent,
  calculatePathRelevance,
  findRelevantFiles,
  buildImportGraph,
  expandFilesWithImports,
  // Code Chunking
  buildChunkedContextAsync,
  buildCodeContext,
  // Confidence Calibration
  type ConfidenceCalibrationResult,
  calibrateConfidence,
  // LLM Re-ranking
  type AIProvider,
  rerankFilesWithLLM,
  // Comment Formatting
  type FormatOptions,
  DEFAULT_MODELS,
  formatInvalidReportComment,
  formatNonBugReportComment,
  formatRootCauseComment,
  // Hallucination Check
  checkForHallucinations,
  applyHallucinationPenalty,
  formatHallucinationReport,
  type VerificationContext,
  type AnalysisToVerify,
  type HallucinationCheckResult,
  // Issue Parser
  type ParsedBugReport,
  parseBugReport,
  extractSearchKeywords,
  inferCategoryFromPerformance,
  buildOptimizedContext,
  isInnerLensBugReport,
  // DOM Extractor
  extractDOMContext,
  formatDOMContextForLLM,
  decompressSessionReplay,
} from './lib/index.js';

import {
  extractIntentWithLLM,
  inferFilesWithLLM,
  getProjectFileTree,
  mergeInferredWithDiscovered,
} from './agents/finder.js';
import type { ExtractedIntent, InferredFile } from './agents/types.js';
import {
  runP5Analysis,
  getPipelineMode,
  type PipelineConfig,
  type LegacyAnalysisResult,
} from './lib/pipeline-adapter.js';

// ============================================
// Type Definitions (imported from ./lib/index.js)
// ============================================


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
  // Output language for analysis comments
  language: OutputLanguage;
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
  // Self-validation fields (2025 enhancement for accuracy)
  selfValidation: z.object({
    counterEvidence: z.array(z.string()).describe('What evidence would DISPROVE this hypothesis? List at least 1-2 items.'),
    assumptions: z.array(z.string()).describe('What assumptions are you making? List any that might be wrong.'),
    confidenceJustification: z.string().describe('Why did you choose this confidence level? Cite specific evidence.'),
    alternativeHypotheses: z.array(z.string()).optional().describe('What other explanations were considered and rejected?'),
  }).describe('Self-validation: explicitly validate your own analysis before finalizing'),
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
  // Output language: en (default), ko, ja, zh, es, de, fr, pt
  language: getOutputLanguage(),
};

// ============================================
// Model Selection
// ============================================

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
// Note: maskSensitiveData is imported from src/utils/masking.ts
// to ensure consistent masking patterns (20 patterns) across the codebase

/**
 * Apply confidence calibration to all analyses in a result
 */
function calibrateAllAnalyses(
  result: AnalysisResult,
  errorLocations: ErrorLocation[],
  codeContext?: string,
  relevantFiles?: string[],
): {
  result: AnalysisResult;
  calibrationReports: ConfidenceCalibrationResult[];
  hallucinationReports: HallucinationCheckResult[];
} {
  const calibrationReports: ConfidenceCalibrationResult[] = [];
  const hallucinationReports: HallucinationCheckResult[] = [];

  const calibratedAnalyses = result.analyses.map(analysis => {
    // Step 1: Apply confidence calibration
    const calibration = calibrateConfidence(analysis, errorLocations);
    calibrationReports.push(calibration);
    let finalConfidence = calibration.calibratedConfidence;
    const allPenalties: string[] = [...calibration.penalties];

    // Step 2: Apply hallucination verification (if context available)
    let hallucinationResult: HallucinationCheckResult | null = null;
    if (codeContext && relevantFiles) {
      const verificationContext: VerificationContext = {
        codeContext,
        projectRoot: process.cwd(),
        relevantFiles,
      };

      const analysisToVerify: AnalysisToVerify = {
        rootCause: {
          affectedFiles: analysis.rootCause.affectedFiles,
          explanation: analysis.rootCause.explanation,
        },
        codeVerification: {
          evidence: analysis.codeVerification.evidence,
        },
        suggestedFix: {
          codeChanges: analysis.suggestedFix.codeChanges,
        },
      };

      hallucinationResult = checkForHallucinations(analysisToVerify, verificationContext);
      hallucinationReports.push(hallucinationResult);

      // Apply hallucination penalty
      const hallucinationPenalty = applyHallucinationPenalty(finalConfidence, hallucinationResult);
      finalConfidence = hallucinationPenalty.confidence;
      allPenalties.push(...hallucinationPenalty.penalties);
    }

    // Build additional context string
    let additionalContextParts: string[] = [];
    if (analysis.additionalContext) {
      additionalContextParts.push(analysis.additionalContext);
    }

    // Add calibration note if calibrated
    if (calibration.wasCalibrated) {
      additionalContextParts.push(
        `📊 **Confidence Calibration:** Original ${calibration.originalConfidence}% → Adjusted ${calibration.calibratedConfidence}%${calibration.penalties.length > 0 ? `\n- ${calibration.penalties.join('\n- ')}` : ''}`
      );
    }

    // Add hallucination verification note if performed
    if (hallucinationResult) {
      additionalContextParts.push(formatHallucinationReport(hallucinationResult));
    }

    // Return analysis with fully calibrated confidence
    return {
      ...analysis,
      confidence: finalConfidence,
      additionalContext: additionalContextParts.length > 0
        ? additionalContextParts.join('\n\n')
        : undefined,
    };
  });

  return {
    result: {
      ...result,
      analyses: calibratedAnalyses,
    },
    calibrationReports,
    hallucinationReports,
  };
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

### Rule 6: Use Extracted User Intent (CRITICAL for Non-English Reports)
If an "Extracted User Intent" section is provided in the bug report:
- This section contains LLM-translated understanding of what the user meant
- Use "Inferred Features/Components" to identify which code to examine
- Use "Expected Behavior" vs "Actual Behavior" to understand the bug
- The original description might be in ANY language - rely on extracted intent
- "Inferred Features" maps user's terms to code equivalents (e.g., "캡쳐버튼" → "CaptureButton")
- ALWAYS search for code matching inferred features in the Code Context
- If intent is clear but description is vague, prioritize intent-based analysis

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
- Maximum 3 analyses - if more potential causes exist, mention them in additionalContext

## ANTI-HALLUCINATION RULES (CRITICAL - VIOLATION = INVALID ANALYSIS)

These rules prevent you from fabricating information. Violations will be automatically detected and penalized.

### Rule 1: File Reference Constraint
- ONLY mention files that appear in the "## Code Context" section below
- If a file is not shown, you CANNOT know its contents - do NOT guess
- Before referencing a file, verify it exists in the provided context
- ❌ WRONG: "The bug is in UserService.ts" (if UserService.ts is not in context)
- ✅ RIGHT: "Based on the provided files, I cannot locate the exact source"

### Rule 2: Line Number Constraint
- ONLY cite line numbers if you can quote the EXACT code at that line
- Line numbers in context are shown as "00042| code here" format
- ❌ WRONG: "Fix line 127 in server.ts" (without quoting line 127's content)
- ✅ RIGHT: "Fix line 42 in server.ts where \`const user = null\` should be..."

### Rule 3: Code Citation Constraint
- Every "before" code in suggestedFix MUST be copy-pasted from context
- Do NOT paraphrase or "clean up" the original code
- If you can't find the exact code to change, use codeChanges: []
- ❌ WRONG: before: "function validate(x) { ... }" (summarized)
- ✅ RIGHT: before: "function validate(x) {\\n  return x != null;\\n}" (exact match)

### Rule 4: Uncertainty Acknowledgment
When context is insufficient:
- Set reportType: "cannot_verify"
- Set bugExistsInCode: false
- Set confidence: below 50
- In evidence, state: "Insufficient context to verify. The issue may exist in files not provided."

### Rule 5: No Invented Symbols
- Do NOT reference function/class/variable names not present in context
- If you need to suggest creating a new function, clearly mark it as NEW
- ❌ WRONG: "The validateUserInput() function has a bug" (if not in context)
- ✅ RIGHT: "Consider creating a new validateUserInput() function that..."

### Automatic Verification
Your response will be automatically verified against:
1. File existence in project
2. Code snippet matching in context
3. Line number validity
4. Symbol existence in provided code

Failed verifications will cap your confidence at 30% and flag the analysis.

## SELF-VALIDATION (MANDATORY - FILL ALL FIELDS)

You MUST complete the selfValidation section for EVERY analysis. This prevents overconfident or hallucinated conclusions.

### Required Fields:

1. **counterEvidence** (array, min 1 item):
   - What evidence would DISPROVE your hypothesis?
   - Example: "If the error only occurs in production, it might be environment-specific rather than a code bug"
   - Example: "If other users don't report this issue, it could be user-specific configuration"

2. **assumptions** (array, min 1 item):
   - What are you assuming that might be wrong?
   - Example: "Assuming the stack trace is accurate and not truncated"
   - Example: "Assuming this is the only place where this error could originate"

3. **confidenceJustification** (string, REQUIRED):
   - WHY did you choose this confidence level?
   - MUST cite specific evidence from the code context
   - Example: "90% confidence because stack trace directly points to line 42, and the null check is clearly missing"
   - Example: "50% confidence because the described behavior could have multiple causes and I only see one of them"

4. **alternativeHypotheses** (optional array):
   - What other explanations did you consider and reject?
   - Include why you rejected them

### Confidence Level Guidelines (with selfValidation):
- **90-100%**: Stack trace + code evidence + no counter-evidence
- **70-89%**: Strong evidence + some assumptions + minor counter-evidence
- **50-69%**: Reasonable hypothesis + multiple assumptions + significant counter-evidence
- **Below 50%**: Speculative + many assumptions + strong counter-evidence possible

## EXTENDED CONTEXT DATA USAGE

Bug reports from inner-lens include rich contextual data. Use ALL available sections:

### Page Context Section
When present, extract:
- **Route/Pathname**: Where the bug occurred (helps locate relevant code)
- **Time on Page**: Long time may indicate memory leak or performance issue
- **Component Stack**: React component hierarchy (if available)

### Performance Section
Core Web Vitals can indicate performance-related bugs:
- **High LCP (>2500ms)**: Slow initial render, blocking resources
- **High FID (>100ms)**: Main thread blocking, heavy JS execution
- **High CLS (>0.1)**: Layout shifts, dynamic content issues
- **High TTFB (>600ms)**: Server-side issues, slow API responses

### User Actions Section
Sequence of actions leading to the bug:
- Identify the exact interaction that triggered the error
- Look for patterns (e.g., rapid clicks, specific input values)
- Match actions to error timestamps for correlation

### Navigation History Section
Page flow before the issue:
- State management issues across page transitions
- Race conditions from rapid navigation
- Authentication/session issues after redirects

### Console Logs Section
Network requests and errors:
- [NETWORK] entries show API call details (status, duration, response)
- Failed requests (4xx, 5xx) may indicate API issues
- Error logs with stack traces are highest priority

### Integration Tips
1. Cross-reference error timestamps with user actions
2. Check if performance metrics correlate with reported symptoms
3. Use navigation history to understand the user's journey
4. Network logs reveal backend vs frontend issues`;

/**
 * Get the system prompt with language-specific instructions
 */
function getSystemPrompt(language: OutputLanguage): string {
  const languageName = LANGUAGE_NAMES[language];

  // Language-specific instructions
  const languageInstructions = language === 'en' ? '' : `

## OUTPUT LANGUAGE REQUIREMENT

**CRITICAL: You MUST write ALL analysis output in ${languageName}.**

This includes:
- rootCause.summary and rootCause.explanation
- suggestedFix.steps and suggestedFix.codeChanges[].description
- prevention items
- additionalContext
- codeVerification.evidence and codeVerification.alternativeExplanation
- invalidReason (if applicable)

**Exceptions (keep in English):**
- File paths and code snippets
- Technical terms that don't have standard translations
- Variable/function names from the codebase

Example for Korean (ko):
- rootCause.summary: "사용자 입력값 검증 누락으로 인한 null 참조 오류"
- suggestedFix.steps: ["1. UserService.ts의 validateInput 함수에 null 체크 추가", "2. 단위 테스트 작성"]`;

  return SYSTEM_PROMPT + languageInstructions;
}

const USER_PROMPT_TEMPLATE = (
  title: string,
  body: string,
  codeContext: string,
  keywords: string[],
  extractedIntent?: ExtractedIntent | null
) => {
  const intentSection = extractedIntent ? `
## Extracted User Intent (LLM-analyzed from potentially non-English report)
- **User Action:** ${extractedIntent.userAction}
- **Expected Behavior:** ${extractedIntent.expectedBehavior}
- **Actual Behavior:** ${extractedIntent.actualBehavior}
- **Inferred Features/Components:** ${extractedIntent.inferredFeatures.join(', ')}
- **UI Elements Involved:** ${extractedIntent.uiElements.join(', ')}
- **Error Patterns:** ${extractedIntent.errorPatterns.join(', ') || 'None explicit'}
- **Page Context:** ${extractedIntent.pageContext || 'Unknown'}

**IMPORTANT**: Use the "Inferred Features/Components" above to search for related code in the Code Context.
The original description may be in any language - rely on this extracted intent for understanding.
` : '';

  return `Analyze this bug report using the Chain-of-Thought methodology:

## Bug Report

### Title
${title}

### Description
${body}
${intentSection}
### Extracted Keywords
${keywords.join(', ')}

## Code Context
${codeContext || 'No relevant code files found in the repository.'}

---

Please analyze this bug step-by-step following the methodology, then provide your structured analysis.`;
};

// ============================================
// Retry Logic
// ============================================

interface RetryError {
  attempt: number;
  error: Error;
  details?: string;
}

function extractErrorDetails(error: Error): string | undefined {
  const details: string[] = [];

  if ('cause' in error && error.cause) {
    const cause = error.cause as Error;
    if (cause.name === 'ZodError' && 'issues' in cause) {
      const issues = (cause as { issues: Array<{ path: (string | number)[]; message: string }> }).issues;
      details.push('Zod validation failed:');
      issues.slice(0, 3).forEach((issue) => {
        details.push(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
      if (issues.length > 3) {
        details.push(`  ... and ${issues.length - 3} more issues`);
      }
    } else {
      details.push(`Cause: ${cause.message || String(cause)}`);
    }
  }

  if ('text' in error && typeof (error as { text?: string }).text === 'string') {
    const text = (error as { text: string }).text;
    if (text.length > 0) {
      const preview = text.length > 200 ? text.slice(0, 200) + '...' : text;
      details.push(`Raw model output: ${preview}`);
    }
  }

  if ('finishReason' in error) {
    details.push(`Finish reason: ${(error as { finishReason: string }).finishReason}`);
  }

  return details.length > 0 ? details.join('\n') : undefined;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  const errors: RetryError[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const details = extractErrorDetails(errorObj);
      errors.push({ attempt, error: errorObj, details });

      if (attempt < maxAttempts) {
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        process.stdout.write(`   ⚠️ Attempt ${attempt}/${maxAttempts} failed, retrying in ${waitTime}ms...\n`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  console.log(`\n   ❌ All ${maxAttempts} attempts failed:`);
  errors.forEach(({ attempt, error, details }) => {
    console.log(`      [Attempt ${attempt}] ${error.message}`);
    if (details) {
      details.split('\n').forEach(line => console.log(`         ${line}`));
    }
  });

  throw errors[errors.length - 1]?.error;
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
// Main Analysis Function
// ============================================

async function analyzeIssue(): Promise<void> {
  console.log('🔍 inner-lens Analysis Engine v2 Starting...\n');
  console.log(`📋 Issue: ${config.owner}/${config.repo}#${config.issueNumber}`);
  console.log(`🤖 Provider: ${config.provider}`);
  console.log(`🌐 Language: ${LANGUAGE_NAMES[config.language]}`);

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
  const isStructuredReport = isInnerLensBugReport(maskedBody);

  let parsedReport: ParsedBugReport | null = null;
  let categoryHint: string | null = null;

  if (isStructuredReport) {
    console.log('   📋 Detected inner-lens structured bug report');
    parsedReport = parseBugReport(maskedBody);

    if (parsedReport.pageContext.route) {
      console.log(`   📍 Page Route: ${parsedReport.pageContext.route}`);
    }
    if (parsedReport.userActions.length > 0) {
      console.log(`   🖱️ User Actions: ${parsedReport.userActions.length} captured`);
    }
    if (parsedReport.sessionReplay.hasData) {
      console.log(`   📹 Session Replay: ${parsedReport.sessionReplay.sizeKB}KB (excluded from LLM context)`);
    }

    categoryHint = inferCategoryFromPerformance(parsedReport.performance);
    if (categoryHint) {
      console.log(`   ⚡ Performance hint: likely ${categoryHint} issue`);
    }
  }

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

  // 2c. Extract general keywords + enhanced keywords from parsed report
  let keywords = extractKeywords(issueText);
  if (parsedReport) {
    const enhancedKeywords = extractSearchKeywords(parsedReport);
    keywords = [...new Set([...keywords, ...enhancedKeywords])];
    console.log(`   🔤 Keywords enhanced: ${keywords.length} total (${enhancedKeywords.length} from structured data)`);
  } else {
    console.log(`   🔤 Found ${keywords.length} keywords: ${keywords.slice(0, 5).join(', ')}...`);
  }

  // ============================================
  // Pipeline Mode Check (P5 vs Legacy)
  // ============================================
  const pipelineMode = getPipelineMode();
  console.log(`\n🔧 Pipeline Mode: ${pipelineMode.toUpperCase()}`);

  if (pipelineMode === 'p5') {
    // Use P5 Multi-Agent Pipeline
    console.log('\n═══════════════════════════════════════════════');
    console.log('   🤖 Using P5 Multi-Agent Analysis Pipeline');
    console.log('═══════════════════════════════════════════════');

    const model = getModel();
    const p5Config: PipelineConfig = {
      mode: 'p5',
      model: model as unknown as import('ai').LanguageModel,
      maxFiles: config.maxFiles,
      maxTokens: config.maxTokens,
      language: config.language,
      verbose: true,
    };

    try {
      const { result: p5Analysis, orchestratorResult } = await runP5Analysis(
        maskedTitle,
        maskedBody,
        config.issueNumber,
        config.owner,
        config.repo,
        p5Config,
        parsedReport ?? undefined
      );

      console.log(`\n   ✅ P5 Analysis Complete`);
      console.log(`      Level: ${orchestratorResult.level}`);
      console.log(`      Duration: ${orchestratorResult.totalDuration}ms`);
      console.log(`      Confidence: ${orchestratorResult.analysis.confidence}%`);

      const filesAnalyzed = orchestratorResult.agentResults.finder?.data.relevantFiles.length ?? 0;
      await postP5AnalysisComments(octokit, p5Analysis, filesAnalyzed, config);

      console.log('\n✅ P5 Analysis complete!');
      console.log(`🔗 https://github.com/${config.owner}/${config.repo}/issues/${config.issueNumber}`);
      return;


    } catch (p5Error) {
      console.error('\n❌ P5 Pipeline failed');
      console.error(`   Error: ${p5Error instanceof Error ? p5Error.message : String(p5Error)}`);
      throw p5Error;
    }
  } else {
    throw new Error(`Unknown pipeline mode: ${pipelineMode}. Expected 'p5' (default).`);
  }
}

async function postP5AnalysisComments(
  octokit: Octokit,
  analysis: LegacyAnalysisResult,
  filesAnalyzed: number,
  cfg: AnalysisConfig
): Promise<void> {
  console.log('\n💬 Step 6: Posting analysis comments...');

  const formatOptions: FormatOptions = {
    provider: cfg.provider,
    model: cfg.model,
    filesAnalyzed,
    language: cfg.language,
  };

  if (!analysis.isValidReport) {
    const commentBody = formatInvalidReportComment(analysis.invalidReason, formatOptions);
    await octokit.issues.createComment({
      owner: cfg.owner,
      repo: cfg.repo,
      issue_number: cfg.issueNumber,
      body: commentBody,
    });
    console.log('   📝 Posted invalid report comment');
  } else if (analysis.reportType !== 'bug') {
    const firstAnalysis = analysis.analyses[0];
    if (firstAnalysis) {
      const commentBody = formatNonBugReportComment(analysis.reportType, firstAnalysis, formatOptions);
      await octokit.issues.createComment({
        owner: cfg.owner,
        repo: cfg.repo,
        issue_number: cfg.issueNumber,
        body: commentBody,
      });
      console.log('   📝 Posted non-bug report comment');
    }
  } else {
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
        owner: cfg.owner,
        repo: cfg.repo,
        issue_number: cfg.issueNumber,
        body: commentBody,
      });
      console.log(`   📝 Posted analysis comment ${i + 1}/${totalAnalyses}`);

      if (i < totalAnalyses - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  console.log('\n🏷️ Step 7: Adding labels...');
  await addAnalysisLabels(octokit, analysis, cfg);
}

async function addAnalysisLabels(
  octokit: Octokit,
  analysis: LegacyAnalysisResult,
  cfg: AnalysisConfig
): Promise<void> {
  const labelsToAdd: string[] = ['status:analyzed'];

  const categoryToArea: Record<string, string> = {
    runtime_error: 'area:runtime',
    logic_error: 'area:logic',
    performance: 'area:performance',
    security: 'area:security',
    ui_ux: 'area:ui-ux',
    configuration: 'area:config',
  };

  if (!analysis.isValidReport) {
    labelsToAdd.push('type:invalid', 'status:needs-info');
  } else {
    switch (analysis.reportType) {
      case 'bug': {
        labelsToAdd.push('type:bug');
        const severities = new Set<string>();
        const areas = new Set<string>();
        let hasVerifiedBug = false;
        let hasUnverifiedBug = false;

        for (const rootCauseAnalysis of analysis.analyses) {
          if (rootCauseAnalysis.severity && rootCauseAnalysis.severity !== 'none') {
            severities.add(`severity:${rootCauseAnalysis.severity}`);
          }
          const areaLabel = categoryToArea[rootCauseAnalysis.category];
          if (areaLabel) {
            areas.add(areaLabel);
          }
          if (rootCauseAnalysis.codeVerification?.bugExistsInCode) {
            hasVerifiedBug = true;
          } else {
            hasUnverifiedBug = true;
          }
        }

        const severityPriority = ['severity:critical', 'severity:high', 'severity:medium', 'severity:low'];
        for (const sev of severityPriority) {
          if (severities.has(sev)) {
            labelsToAdd.push(sev);
            break;
          }
        }
        areas.forEach(area => labelsToAdd.push(area));

        if (hasVerifiedBug) {
          labelsToAdd.push('ai:verified');
        } else if (hasUnverifiedBug) {
          labelsToAdd.push('ai:unverified');
        }
        if (analysis.analyses.length > 1) {
          labelsToAdd.push('multi-cause');
        }
        break;
      }
      case 'not_a_bug':
        labelsToAdd.push('type:invalid', 'resolution:not-a-bug');
        break;
      case 'feature_request':
        labelsToAdd.push('type:enhancement', 'kind:feature');
        break;
      case 'improvement':
        labelsToAdd.push('type:enhancement', 'kind:improvement');
        break;
      case 'cannot_verify':
        labelsToAdd.push('type:bug', 'status:needs-repro', 'ai:unverified');
        break;
      case 'needs_info':
        labelsToAdd.push('status:needs-info');
        break;
    }
  }

  const uniqueLabels = [...new Set(labelsToAdd)];

  const labelColors: Record<string, { color: string; description: string }> = {
    'type:bug': { color: 'FF0000', description: 'Something isn\'t working' },
    'type:enhancement': { color: '0066FF', description: 'New feature or request' },
    'type:invalid': { color: 'CCCCCC', description: 'Invalid or incomplete report' },
    'severity:critical': { color: '8B0000', description: 'Critical: System down or data loss' },
    'severity:high': { color: 'FF4500', description: 'High: Major functionality broken' },
    'severity:medium': { color: 'FFA500', description: 'Medium: Minor functionality issue' },
    'severity:low': { color: '32CD32', description: 'Low: Cosmetic or minor issue' },
    'area:runtime': { color: '8B008B', description: 'Runtime errors and crashes' },
    'area:logic': { color: '9932CC', description: 'Logic errors and wrong behavior' },
    'area:performance': { color: 'FF8C00', description: 'Performance issues' },
    'area:security': { color: 'DC143C', description: 'Security vulnerabilities' },
    'area:ui-ux': { color: '1E90FF', description: 'UI/UX issues' },
    'area:config': { color: '708090', description: 'Configuration issues' },
    'status:analyzing': { color: 'FFA500', description: 'AI analysis in progress' },
    'status:analyzed': { color: '006400', description: 'AI analysis complete' },
    'status:needs-info': { color: 'FF69B4', description: 'More information needed' },
    'status:needs-repro': { color: 'FFD700', description: 'Reproduction steps needed' },
    'ai:verified': { color: '228B22', description: 'Bug verified in code by AI' },
    'ai:unverified': { color: 'A9A9A9', description: 'Needs manual verification' },
    'resolution:not-a-bug': { color: 'E0E0E0', description: 'Not a bug - working as intended' },
    'kind:feature': { color: '00CED1', description: 'Feature request' },
    'kind:improvement': { color: '20B2AA', description: 'Improvement suggestion' },
    'multi-cause': { color: 'FF6347', description: 'Multiple root causes identified' },
  };

  if (uniqueLabels.length > 0) {
    console.log('   Creating/updating labels if needed...');
    for (const labelName of uniqueLabels) {
      const labelDef = labelColors[labelName];
      if (labelDef) {
        try {
          await octokit.issues.updateLabel({
            owner: cfg.owner,
            repo: cfg.repo,
            name: labelName,
            color: labelDef.color,
            description: labelDef.description,
          });
        } catch {
          try {
            await octokit.issues.createLabel({
              owner: cfg.owner,
              repo: cfg.repo,
              name: labelName,
              color: labelDef.color,
              description: labelDef.description,
            });
            console.log(`   Created label: ${labelName}`);
          } catch {
            // Label might already exist
          }
        }
      }
    }

    try {
      await octokit.issues.addLabels({
        owner: cfg.owner,
        repo: cfg.repo,
        issue_number: cfg.issueNumber,
        labels: uniqueLabels,
      });
      console.log(`   ✅ Added labels: ${uniqueLabels.join(', ')}`);
    } catch {
      console.log('   ⚠️ Could not add labels');
    }

    try {
      await octokit.issues.removeLabel({
        owner: cfg.owner,
        repo: cfg.repo,
        issue_number: cfg.issueNumber,
        name: 'status:analyzing',
      });
      console.log('   🔓 Removed status:analyzing label (lock released)');
    } catch {
      // Label might not exist
    }
  }
}

analyzeIssue().catch((error) => {
  console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
