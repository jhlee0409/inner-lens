/**
 * Reviewer Agent (P5 Phase 4)
 *
 * Responsible for (Level 2 only, optional):
 * - Validating the analysis from Explainer Agent
 * - Checking for counter-evidence
 * - Adjusting confidence based on review
 * - Identifying potential issues with the analysis
 *
 * This agent runs only in Level 2 and can be disabled via config.
 */

import { generateObject } from 'ai';
import { z } from 'zod';

import type {
  Agent,
  AgentConfig,
  ReviewerInput,
  ReviewerOutput,
  ReviewResult,
  AnalysisResult,
} from './types.js';
import { type OutputLanguage, getI18n } from '../lib/i18n.js';

// ============================================
// Review Schema
// ============================================

const ReviewResultSchema = z.object({
  approved: z.boolean().describe('Whether the analysis is approved'),
  confidenceAdjustment: z.number().min(-50).max(20).describe('Adjustment to confidence (-50 to +20)'),
  issues: z.array(z.string()).describe('Issues found in the analysis'),
  suggestions: z.array(z.string()).describe('Suggestions for improvement'),
  counterEvidence: z.array(z.string()).optional().describe('Counter-evidence found'),
  verifiedClaims: z.array(z.string()).optional().describe('Claims verified as accurate'),
});

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are a senior code review expert validating bug analysis reports. Your role is to ensure analysis quality and accuracy.

## Your Task
Review the bug analysis and validate:
1. **Evidence Quality**: Are claims backed by code references?
2. **Logic Soundness**: Does the root cause explanation make sense?
3. **Counter-Evidence**: Is there evidence that contradicts the conclusion?
4. **Fix Validity**: Would the suggested fixes actually work?

## Review Criteria

### Approve (approved: true) if:
- Root cause is clearly identified with code evidence
- Fix suggestions are specific and actionable
- No major counter-evidence found
- Confidence level is appropriately calibrated

### Reject (approved: false) if:
- Claims are made without code evidence
- Root cause explanation has logical flaws
- Significant counter-evidence is ignored
- Fix suggestions are vague or wouldn't work

## Confidence Adjustment Guidelines
- **+10 to +20**: Analysis is exceptionally thorough, all claims verified
- **0**: Analysis is acceptable as-is
- **-10 to -20**: Minor issues found, some claims unverified
- **-30 to -50**: Major issues, significant counter-evidence, or logical flaws

## Review Format
For each issue found:
1. Quote the problematic claim
2. Explain why it's an issue
3. Suggest how to fix it

For verified claims:
- Note which file:line references you verified
- Confirm the logic chain is sound`;

// ============================================
// User Prompt Template
// ============================================

function buildUserPrompt(
  analysis: AnalysisResult,
  codeContext: string,
  hypotheses?: string[]
): string {
  let prompt = `Review this bug analysis for accuracy and quality:

## Analysis to Review

### Validity
${analysis.isValidReport ? 'Valid Report' : `Invalid: ${analysis.invalidReason || 'Unknown'}`}

### Severity & Category
- Severity: ${analysis.severity}
- Category: ${analysis.category}
- Confidence: ${analysis.confidence}%

### Root Cause
**Summary:** ${analysis.rootCause.summary}

**Explanation:**
${analysis.rootCause.explanation}

**Affected Files:** ${analysis.rootCause.affectedFiles.join(', ') || 'None specified'}

${analysis.rootCause.evidenceChain ? `**Evidence Chain:**
${analysis.rootCause.evidenceChain.map((e, i) => `${i + 1}. ${e}`).join('\n')}` : ''}

### Suggested Fix
**Steps:**
${analysis.suggestedFix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

**Code Changes:**
${analysis.suggestedFix.codeChanges.length > 0
    ? analysis.suggestedFix.codeChanges.map(c => `- ${c.file}: ${c.description}`).join('\n')
    : 'None specified'}

### Prevention
${analysis.prevention.map(p => `- ${p}`).join('\n')}

## Code Context (for verification)
${codeContext || 'No code context available'}
`;

  if (hypotheses && hypotheses.length > 0) {
    prompt += `
## Alternative Hypotheses (from Investigator)
${hypotheses.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Check if these alternatives were properly considered.
`;
  }

  prompt += `
---

Review this analysis:
1. Verify claims against the code context
2. Check for counter-evidence
3. Validate the fix suggestions
4. Determine if confidence level is appropriate
5. Provide issues and suggestions`;

  return prompt;
}

// ============================================
// Apply Review to Analysis
// ============================================

function applyReview(analysis: AnalysisResult, review: ReviewResult, language: OutputLanguage = 'en'): AnalysisResult {
  const t = getI18n(language);

  let newConfidence = analysis.confidence + review.confidenceAdjustment;
  newConfidence = Math.max(0, Math.min(100, newConfidence));

  const reviewNotes: string[] = [];

  if (!review.approved) {
    reviewNotes.push(`⚠️ **${t.reviewStatus}:** ${t.issuesFoundDuringReview}`);
  } else {
    reviewNotes.push(`✅ **${t.reviewStatus}:** ${t.analysisApproved}`);
  }

  if (review.issues.length > 0) {
    reviewNotes.push(`\n**${t.issuesFound}:**\n${review.issues.map(i => `- ${i}`).join('\n')}`);
  }

  if (review.suggestions.length > 0) {
    reviewNotes.push(`\n**${t.reviewerSuggestions}:**\n${review.suggestions.map(s => `- ${s}`).join('\n')}`);
  }

  if (review.verifiedClaims && review.verifiedClaims.length > 0) {
    reviewNotes.push(`\n**${t.verifiedClaimsLabel}:**\n${review.verifiedClaims.map(c => `✓ ${c}`).join('\n')}`);
  }

  if (review.counterEvidence && review.counterEvidence.length > 0) {
    reviewNotes.push(`\n**${t.counterEvidence}:**\n${review.counterEvidence.map(c => `⚠️ ${c}`).join('\n')}`);
  }

  const existingContext = analysis.additionalContext || '';
  const newContext = `${existingContext}\n\n---\n\n## ${t.reviewerNotesTitle}\n\n${reviewNotes.join('\n')}`;

  return {
    ...analysis,
    confidence: newConfidence,
    additionalContext: newContext.trim(),
  };
}

// ============================================
// Reviewer Agent Implementation
// ============================================

export const reviewerAgent: Agent<ReviewerInput, ReviewerOutput> = {
  name: 'reviewer',
  description: 'Validates analysis quality and adjusts confidence (Level 2 only)',
  requiredLevel: 2,

  async execute(input: ReviewerInput, config?: AgentConfig): Promise<ReviewerOutput> {
    const startTime = Date.now();

    try {
      const { finderOutput, explainerOutput, investigatorOutput } = input;

      console.log('\n✅ Reviewer Agent starting (L2)...');

      // Validate model is provided
      if (!config?.model) {
        throw new Error('Reviewer Agent requires a model to be configured');
      }

      const analysis = explainerOutput.data.analysis;

      // Skip review for invalid reports
      if (!analysis.isValidReport) {
        console.log('   ⏭️ Skipping review for invalid report');
        return {
          agentName: 'reviewer',
          success: true,
          duration: Date.now() - startTime,
          data: {
            review: {
              approved: true,
              confidenceAdjustment: 0,
              issues: [],
              suggestions: [],
            },
            finalAnalysis: analysis,
          },
        };
      }

      // Get hypotheses for context
      const hypotheses = investigatorOutput?.data.hypotheses.map(h => h.summary);

      // Build user prompt
      const userPrompt = buildUserPrompt(
        analysis,
        finderOutput.data.codeContext,
        hypotheses
      );

      console.log('   🤖 Reviewing analysis with LLM...');

      // Generate review
      const { object: review } = await generateObject({
        model: config.model,
        schema: ReviewResultSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 1500,
        abortSignal: AbortSignal.timeout(60_000), // 60 second timeout
      });

      const finalAnalysis = applyReview(analysis, review, config.language);

      console.log(`   ✅ Review complete`);
      console.log(`      Approved: ${review.approved}`);
      console.log(`      Confidence adjustment: ${review.confidenceAdjustment > 0 ? '+' : ''}${review.confidenceAdjustment}`);
      console.log(`      Issues found: ${review.issues.length}`);
      console.log(`      Final confidence: ${finalAnalysis.confidence}%`);

      const duration = Date.now() - startTime;

      return {
        agentName: 'reviewer',
        success: true,
        duration,
        data: {
          review,
          finalAnalysis,
        },
      };
    } catch (error) {
      console.error('   ❌ Reviewer Agent failed:', error);

      const duration = Date.now() - startTime;

      // Return original analysis on failure
      return {
        agentName: 'reviewer',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        data: {
          review: {
            approved: true,
            confidenceAdjustment: 0,
            issues: ['Review failed - using unreviewed analysis'],
            suggestions: [],
          },
          finalAnalysis: input.explainerOutput.data.analysis,
        },
      };
    }
  },
};

export default reviewerAgent;
