/**
 * Investigator Agent (P5 Phase 3)
 *
 * Responsible for (Level 2 only):
 * - Generating multiple hypotheses about root causes
 * - Collecting supporting and contra evidence for each hypothesis
 * - Ranking hypotheses by likelihood
 * - Providing additional context for the Explainer Agent
 *
 * This agent runs only in Level 2 (thorough) analysis mode.
 */

import { generateObject } from 'ai';
import { z } from 'zod';

import type {
  Agent,
  AgentConfig,
  InvestigatorInput,
  InvestigatorOutput,
  Hypothesis,
} from './types.js';

// ============================================
// Hypothesis Schema
// ============================================

const HypothesisSchema = z.object({
  id: z.string().describe('Unique identifier for this hypothesis'),
  summary: z.string().describe('One-line summary of the hypothesis'),
  explanation: z.string().describe('Detailed explanation of why this could be the cause'),
  likelihood: z.number().min(0).max(100).describe('Likelihood percentage (0-100)'),
  supportingEvidence: z.array(z.string()).describe('Evidence that supports this hypothesis'),
  contraEvidence: z.array(z.string()).describe('Evidence that contradicts this hypothesis'),
});

const InvestigatorResultSchema = z.object({
  hypotheses: z.array(HypothesisSchema).min(1).max(5).describe('List of possible root causes'),
  primaryHypothesis: z.string().describe('ID of the most likely hypothesis'),
  additionalContext: z.string().describe('Additional investigation notes'),
});

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `You are a bug investigation expert. Your role is to generate multiple hypotheses about what could be causing a reported bug.

## Your Task
Analyze the bug report and code context to generate 2-4 distinct hypotheses about the root cause.

## Hypothesis Requirements
For each hypothesis:
1. **Be Specific**: Don't just say "there's a bug" - identify the specific mechanism
2. **Cite Evidence**: Reference actual code locations (file:line) that support your hypothesis
3. **Consider Alternatives**: Think about what could disprove your hypothesis
4. **Assign Likelihood**: Based on evidence strength, assign a percentage (0-100)

## Evidence Quality
- **Strong Evidence (80-100%)**: Stack trace points directly to the issue, code clearly shows bug
- **Moderate Evidence (50-79%)**: Pattern matches known bug types, circumstantial evidence
- **Weak Evidence (20-49%)**: Speculation based on common patterns
- **Very Weak (<20%)**: Pure speculation with no direct evidence

## Hypothesis Categories to Consider
1. **Data Issues**: Null/undefined values, type mismatches, invalid data
2. **Logic Errors**: Wrong conditions, off-by-one, race conditions
3. **Integration Issues**: API misuse, dependency conflicts, version issues
4. **Configuration Issues**: Missing env vars, wrong settings
5. **Timing Issues**: Race conditions, async ordering, timeouts

## Output Format
Generate hypotheses ordered by likelihood (highest first).
Always include at least one "alternative" hypothesis that challenges the obvious conclusion.`;

// ============================================
// User Prompt Template
// ============================================

function buildUserPrompt(
  title: string,
  body: string,
  codeContext: string,
  keywords: string[],
  callGraphInfo?: string
): string {
  let prompt = `Investigate this bug and generate hypotheses about its root cause:

## Bug Report

### Title
${title}

### Description
${body}

### Extracted Keywords
${keywords.join(', ')}

## Code Context
${codeContext || 'No relevant code files found.'}
`;

  if (callGraphInfo) {
    prompt += `
## Call Graph Analysis
${callGraphInfo}
`;
  }

  prompt += `
---

Generate 2-4 distinct hypotheses about what could be causing this bug.
For each hypothesis:
1. Provide a clear summary
2. Explain the mechanism
3. List supporting evidence with file:line references
4. List any contradicting evidence
5. Assign a likelihood percentage

Include at least one "alternative" hypothesis that considers a less obvious cause.`;

  return prompt;
}

// ============================================
// Call Graph Context Builder
// ============================================

function buildCallGraphContext(
  finderOutput: InvestigatorInput['finderOutput'],
  errorLocations: InvestigatorInput['issueContext']['errorLocations']
): string {
  const callGraph = finderOutput.data.callGraph;
  if (!callGraph || callGraph.size === 0) {
    return '';
  }

  const lines: string[] = ['### Function Call Relationships'];

  // Find functions mentioned in error locations
  for (const loc of errorLocations.slice(0, 3)) {
    if (loc.functionName) {
      const node = callGraph.get(loc.functionName);
      if (node) {
        lines.push(`\n**${loc.functionName}** (from stack trace)`);
        if (node.calledBy.length > 0) {
          lines.push(`  Called by: ${node.calledBy.slice(0, 5).join(', ')}`);
        }
        if (node.calls.length > 0) {
          lines.push(`  Calls: ${node.calls.slice(0, 5).join(', ')}`);
        }
        lines.push(`  Lines: ${node.lines.start}-${node.lines.end}`);
        lines.push(`  Async: ${node.isAsync}, Exported: ${node.isExported}`);
      }
    }
  }

  return lines.length > 1 ? lines.join('\n') : '';
}

// ============================================
// Investigator Agent Implementation
// ============================================

export const investigatorAgent: Agent<InvestigatorInput, InvestigatorOutput> = {
  name: 'investigator',
  description: 'Generates multiple hypotheses about bug root causes (Level 2 only)',
  requiredLevel: 2,

  async execute(input: InvestigatorInput, config?: AgentConfig): Promise<InvestigatorOutput> {
    const startTime = Date.now();

    try {
      const { issueContext, finderOutput } = input;

      console.log('\n🧠 Investigator Agent starting (L2)...');

      // Validate model is provided
      if (!config?.model) {
        throw new Error('Investigator Agent requires a model to be configured');
      }

      // Build call graph context
      const callGraphContext = buildCallGraphContext(finderOutput, issueContext.errorLocations);

      // Build user prompt
      const userPrompt = buildUserPrompt(
        issueContext.title,
        issueContext.body,
        finderOutput.data.codeContext,
        issueContext.keywords,
        callGraphContext
      );

      console.log('   🤖 Generating hypotheses with LLM...');

      // Generate hypotheses
      const { object: result } = await generateObject({
        model: config.model,
        schema: InvestigatorResultSchema,
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 2000,
        abortSignal: AbortSignal.timeout(60_000), // 60 second timeout
      });

      // Validate and normalize hypotheses
      const hypotheses: Hypothesis[] = result.hypotheses.map((h, i) => ({
        id: h.id || `h${i + 1}`,
        summary: h.summary,
        explanation: h.explanation,
        likelihood: h.likelihood,
        supportingEvidence: h.supportingEvidence || [],
        contraEvidence: h.contraEvidence || [],
      }));

      // Sort by likelihood
      hypotheses.sort((a, b) => b.likelihood - a.likelihood);

      console.log(`   ✅ Generated ${hypotheses.length} hypotheses`);
      hypotheses.forEach((h, i) => {
        console.log(`      ${i + 1}. [${h.likelihood}%] ${h.summary.slice(0, 60)}...`);
      });

      const duration = Date.now() - startTime;

      return {
        agentName: 'investigator',
        success: true,
        duration,
        data: {
          hypotheses,
          primaryHypothesis: result.primaryHypothesis || hypotheses[0]?.id || 'h1',
          additionalContext: result.additionalContext,
        },
      };
    } catch (error) {
      console.error('   ❌ Investigator Agent failed:', error);

      const duration = Date.now() - startTime;

      // Return fallback with single generic hypothesis
      return {
        agentName: 'investigator',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
        data: {
          hypotheses: [
            {
              id: 'fallback',
              summary: 'Investigation failed - proceeding with direct analysis',
              explanation: `The investigator could not generate hypotheses: ${error instanceof Error ? error.message : String(error)}`,
              likelihood: 50,
              supportingEvidence: [],
              contraEvidence: [],
            },
          ],
          primaryHypothesis: 'fallback',
          additionalContext: 'Fallback hypothesis due to investigation failure.',
        },
      };
    }
  },
};

export default investigatorAgent;
