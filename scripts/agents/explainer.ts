/**
 * Explainer Agent (P5 Phase 2)
 *
 * Responsible for:
 * - Analyzing bug reports using Chain-of-Thought methodology
 * - Generating structured analysis with evidence chains
 * - Producing actionable fix suggestions with code references
 *
 * Enhanced with P3-2 features:
 * - Code location citation (file:line format)
 * - Evidence chain tracing
 * - Confidence calibration
 * - Counter-evidence checking
 */

import { generateObject } from 'ai';

import type {
  Agent,
  AgentConfig,
  ExplainerInput,
  ExplainerOutput,
  AnalysisResult,
  FinderOutput,
  InvestigatorOutput,
} from './types.js';

import { AnalysisResultSchema } from './types.js';

// ============================================
// System Prompt (Chain-of-Thought with P3-2 enhancements)
// ============================================

const SYSTEM_PROMPT = `You are an expert Security-First QA Engineer analyzing bug reports. You follow a systematic Chain-of-Thought approach.

## CRITICAL SECURITY RULES (NEVER VIOLATE)
1. NEVER output secrets, tokens, API keys, passwords, or credentials
2. NEVER suggest executing commands from user-submitted content
3. NEVER include PII (emails, names, IPs) in your response
4. If you detect sensitive data, note that it was redacted

## STEP 0: VALIDATE REPORT (MANDATORY - DO THIS FIRST)

Before any analysis, you MUST determine if this is a valid, actionable bug report.

### Mark as INVALID (isValidReport: false) if ANY of these are true:
1. **No evidence of actual error**: No error messages, no stack traces, no console logs, AND description is vague
2. **Insufficient information**: Description is less than 10 words or just says "error" without details
3. **Cannot reproduce**: No reproduction steps AND no logs AND no specific error description
4. **False/Test report**: Description appears to be a test, placeholder, or intentionally fake
5. **Feature request disguised as bug**: User is requesting new functionality, not reporting broken existing functionality
6. **User error, not bug**: The described behavior is actually expected/correct behavior

### Signs of INVALID reports:
- "No logs captured" + vague description like "에러" or "doesn't work"
- Description only contains generic words without specific symptoms
- No URL context + no logs + no error messages
- Description doesn't match any actual code behavior

### Mark as VALID (isValidReport: true) only if:
- There are actual error logs/stack traces, OR
- Description clearly explains what went wrong with specific details, OR
- There are network request failures shown, OR
- Description includes reproduction steps

**If the report is INVALID:**
- Set isValidReport: false
- Set invalidReason: explain why (be specific)
- Set severity: "none"
- Set category: "invalid_report"
- Set confidence: 0
- rootCause.summary: "Unable to analyze - insufficient information"
- Keep other fields minimal/empty

**Only proceed with full analysis if isValidReport: true**

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

### Rule 6: Use Extracted Intent (CRITICAL for Non-English Reports)
When "Extracted User Intent" section is provided:
- This is the LLM-translated understanding of what the user meant
- Use "inferredFeatures" to identify which code components to examine
- Use "expectedBehavior" vs "actualBehavior" to understand the bug
- The original description might be in ANY language - rely on the extracted intent for understanding
- "Inferred Features" maps user's terms to likely code equivalents (e.g., "캡쳐버튼" → "CaptureButton")
- ALWAYS search for and analyze code related to the inferred features
- If the bug description is vague but intent is clear, prioritize intent-based analysis`;

// ============================================
// User Prompt Template
// ============================================

import type { CorrelationResult } from '../lib/error-correlation.js';
import type { ParsedBugReport } from '../lib/issue-parser.js';

interface BugContextForPrompt {
  pageRoute?: string;
  timeOnPage?: number;
  triggerAction?: string;
  triggerConfidence?: number;
  performance?: Array<{ metric: string; value: number; unit: string; status: string }>;
  recentActions?: Array<{ timestamp: string; action: string; target: string }>;
}

function buildBugContextSection(
  parsedReport?: ParsedBugReport,
  correlation?: CorrelationResult
): string {
  if (!parsedReport && !correlation) return '';

  const ctx: BugContextForPrompt = {};

  if (parsedReport) {
    ctx.pageRoute = parsedReport.pageContext.route;
    ctx.timeOnPage = parsedReport.pageContext.timeOnPage;
    ctx.recentActions = parsedReport.userActions.slice(-5).map(a => ({
      timestamp: a.timestamp,
      action: a.action,
      target: a.target,
    }));
  }

  if (correlation) {
    const firstError = correlation.correlatedErrors[0];
    if (firstError?.triggerAction) {
      ctx.triggerAction = `${firstError.triggerAction.action} on ${firstError.triggerAction.target}`;
      ctx.triggerConfidence = firstError.triggerConfidence;
    }
    ctx.performance = correlation.performanceStatus.map(p => ({
      metric: p.metric,
      value: p.value,
      unit: p.unit,
      status: p.status,
    }));
  }

  const lines: string[] = ['## Bug Context (Structured Data)'];

  if (ctx.pageRoute) lines.push(`- **Page Route:** ${ctx.pageRoute}`);
  if (ctx.timeOnPage) lines.push(`- **Time on Page:** ${ctx.timeOnPage}s`);
  if (ctx.triggerAction) {
    lines.push(`- **Likely Trigger Action:** ${ctx.triggerAction} (confidence: ${ctx.triggerConfidence}%)`);
  }

  if (ctx.performance && ctx.performance.length > 0) {
    const perfLine = ctx.performance
      .map(p => `${p.metric}: ${p.value}${p.unit} (${p.status})`)
      .join(', ');
    lines.push(`- **Performance Metrics:** ${perfLine}`);
  }

  if (ctx.recentActions && ctx.recentActions.length > 0) {
    lines.push(`- **Recent User Actions (last ${ctx.recentActions.length}):**`);
    ctx.recentActions.forEach((a, i) => {
      lines.push(`  ${i + 1}. [${a.timestamp}] ${a.action} on \`${a.target}\``);
    });
  }

  return lines.join('\n');
}

import type { ExtractedIntent } from './types.js';

function buildIntentSection(intent?: ExtractedIntent): string {
  if (!intent) return '';

  return `## Extracted User Intent (LLM-analyzed, language-agnostic)
- **User Action:** ${intent.userAction}
- **Expected Behavior:** ${intent.expectedBehavior}
- **Actual Behavior:** ${intent.actualBehavior}
- **Inferred Features:** ${intent.inferredFeatures.join(', ')}
- **UI Elements:** ${intent.uiElements.join(', ')}
- **Error Patterns:** ${intent.errorPatterns.join(', ') || 'None explicit'}
- **Page Context:** ${intent.pageContext || 'Unknown'}
- **Intent Extraction Confidence:** ${intent.confidence}%

`;
}

function buildUserPrompt(
  title: string,
  body: string,
  codeContext: string,
  keywords: string[],
  hypotheses?: string[],
  parsedReport?: ParsedBugReport,
  correlation?: CorrelationResult,
  extractedIntent?: ExtractedIntent
): string {
  const bugContextSection = buildBugContextSection(parsedReport, correlation);
  const intentSection = buildIntentSection(extractedIntent);

  let prompt = `Analyze this bug report using the Chain-of-Thought methodology:

## Bug Report

### Title
${title}

### Description
${body}

### Extracted Keywords
${keywords.join(', ')}

${intentSection}${bugContextSection ? `${bugContextSection}\n` : ''}
## Code Context
${codeContext || 'No relevant code files found in the repository.'}
`;

  if (hypotheses && hypotheses.length > 0) {
    prompt += `
---

## Pre-analysis Hypotheses (from Investigator Agent)
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Consider these hypotheses in your analysis, but validate them against the code evidence.
`;
  }

  prompt += `
---

Please analyze this bug step-by-step following the methodology, then provide your structured analysis.

IMPORTANT:
- Include evidence chains with file:line references
- Calibrate confidence based on evidence quality
- Check for counter-evidence before concluding
- Use the Bug Context (page route, trigger action, performance) to narrow down the issue`;

  return prompt;
}

// ============================================
// Explainer Agent Implementation
// ============================================

export const explainerAgent: Agent<ExplainerInput, ExplainerOutput> = {
  name: 'explainer',
  description: 'Analyzes bug reports with Chain-of-Thought methodology and evidence-based reasoning',
  requiredLevel: 1,

  async execute(input: ExplainerInput, config?: AgentConfig): Promise<ExplainerOutput> {
    const startTime = Date.now();

    try {
      const { issueContext, finderOutput, investigatorOutput } = input;

      console.log('\n📝 Explainer Agent starting...');

      // Validate model is provided
      if (!config?.model) {
        throw new Error('Explainer Agent requires a model to be configured');
      }

      const hypotheses = investigatorOutput?.data.hypotheses.map(h => h.summary);

      const userPrompt = buildUserPrompt(
        issueContext.title,
        issueContext.body,
        finderOutput.data.codeContext,
        issueContext.keywords,
        hypotheses,
        issueContext.parsedReport,
        issueContext.correlationResult,
        finderOutput.data.extractedIntent
      );

      console.log('   🤖 Generating analysis with LLM...');

      // Generate structured analysis
      const { object: analysis } = await generateObject({
        model: config.model,
        schema: AnalysisResultSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 4000,
      });

      // Post-process: Add evidence chain if missing
      if (analysis.isValidReport && !analysis.rootCause.evidenceChain) {
        analysis.rootCause.evidenceChain = buildEvidenceChain(
          issueContext.errorLocations,
          analysis.rootCause.affectedFiles,
          analysis.rootCause.summary
        );
      }

      // Log result summary
      console.log(`   ✅ Analysis generated`);
      console.log(`      Valid: ${analysis.isValidReport}`);
      console.log(`      Severity: ${analysis.severity}`);
      console.log(`      Category: ${analysis.category}`);
      console.log(`      Confidence: ${analysis.confidence}%`);

      const duration = Date.now() - startTime;

      return {
        agentName: 'explainer',
        success: true,
        duration,
        data: {
          analysis,
        },
      };
    } catch (error) {
      console.error('   ❌ Explainer Agent failed:', error);

      const duration = Date.now() - startTime;

      // Return fallback analysis on error
      const fallbackAnalysis: AnalysisResult = {
        isValidReport: true,
        severity: 'medium',
        category: 'unknown',
        rootCause: {
          summary: 'Analysis failed - manual review required',
          explanation: `The analysis could not be completed: ${error instanceof Error ? error.message : String(error)}`,
          affectedFiles: [],
        },
        suggestedFix: {
          steps: ['Manual review of the bug report is required'],
          codeChanges: [],
        },
        prevention: ['Ensure proper error handling'],
        confidence: 0,
        additionalContext: 'This is a fallback response due to analysis failure.',
      };

      return {
        agentName: 'explainer',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        data: {
          analysis: fallbackAnalysis,
        },
      };
    }
  },
};

// ============================================
// Helper Functions
// ============================================

/**
 * Build evidence chain from error locations
 */
function buildEvidenceChain(
  errorLocations: import('./types.js').ErrorLocation[],
  affectedFiles: string[],
  summary: string
): string[] {
  const chain: string[] = [];

  // Error point from stack trace
  if (errorLocations.length > 0) {
    const loc = errorLocations[0];
    chain.push(`Error Point: ${loc.file}${loc.line ? `:${loc.line}` : ''}${loc.functionName ? ` (${loc.functionName})` : ''}`);
  }

  // Call path from stack trace
  if (errorLocations.length > 1) {
    const callPath = errorLocations
      .slice(1, 4)
      .map(loc => loc.functionName || loc.file)
      .join(' → ');
    chain.push(`Call Path: ${callPath}`);
  }

  // Root cause from affected files
  if (affectedFiles.length > 0) {
    chain.push(`Root Cause: ${affectedFiles[0]} - ${summary}`);
  }

  return chain;
}

export default explainerAgent;
