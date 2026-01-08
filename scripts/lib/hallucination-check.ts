/**
 * Hallucination Check Module
 *
 * Verifies LLM analysis results against actual code context
 * to detect and flag potential hallucinations.
 *
 * Checks performed:
 * 1. File existence - Do mentioned files actually exist?
 * 2. Code citation - Does quoted code appear in the context?
 * 3. Line references - Are file:line references valid?
 * 4. Symbol existence - Do mentioned functions/classes exist?
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

export interface HallucinationCheckResult {
  isValid: boolean;
  score: number; // 0-100, higher = more verified
  checks: HallucinationCheck[];
  summary: string;
}

export interface HallucinationCheck {
  type: 'file' | 'code_citation' | 'line_reference' | 'symbol';
  claim: string;
  verified: boolean;
  details: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface AnalysisToVerify {
  rootCause: {
    affectedFiles: string[];
    explanation: string;
  };
  codeVerification: {
    evidence: string;
  };
  suggestedFix: {
    codeChanges: Array<{
      file: string;
      before?: string;
      after: string;
    }>;
  };
}

export interface VerificationContext {
  codeContext: string; // The code context that was sent to LLM
  projectRoot: string; // Project root directory
  relevantFiles: string[]; // Files that were included in context
}

// ============================================
// File Existence Verification
// ============================================

/**
 * Verify that mentioned files actually exist in the project
 */
export function verifyFileExistence(
  affectedFiles: string[],
  context: VerificationContext
): HallucinationCheck[] {
  const checks: HallucinationCheck[] = [];

  for (const file of affectedFiles) {
    // Normalize the file path
    const normalizedFile = file.replace(/^\//, '').replace(/\\/g, '/');

    // Check 1: Was this file in the context sent to LLM?
    const inContext = context.relevantFiles.some(
      f => f.endsWith(normalizedFile) || normalizedFile.endsWith(path.basename(f))
    );

    // Check 2: Does this file actually exist?
    const possiblePaths = [
      path.join(context.projectRoot, normalizedFile),
      path.join(context.projectRoot, 'src', normalizedFile),
      ...context.relevantFiles.filter(f => f.includes(path.basename(normalizedFile))),
    ];

    const exists = possiblePaths.some(p => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });

    if (!inContext && !exists) {
      checks.push({
        type: 'file',
        claim: `File: ${file}`,
        verified: false,
        details: `File "${file}" was not in context and does not exist in project`,
        severity: 'critical',
      });
    } else if (!inContext && exists) {
      checks.push({
        type: 'file',
        claim: `File: ${file}`,
        verified: true,
        details: `File exists but was not in LLM context - analysis may be inferred`,
        severity: 'warning',
      });
    } else {
      checks.push({
        type: 'file',
        claim: `File: ${file}`,
        verified: true,
        details: `File was in context`,
        severity: 'info',
      });
    }
  }

  return checks;
}

// ============================================
// Code Citation Verification
// ============================================

/**
 * Extract code snippets from LLM evidence text
 */
function extractCodeCitations(text: string): string[] {
  const citations: string[] = [];

  // Match inline code: `code here`
  const inlineCodePattern = /`([^`]+)`/g;
  let match;
  while ((match = inlineCodePattern.exec(text)) !== null) {
    const code = match[1].trim();
    // Filter out file paths and short references
    if (code.length > 10 && !code.includes('/') && !code.match(/^\w+\.\w+$/)) {
      citations.push(code);
    }
  }

  // Match code blocks: ```code```
  const codeBlockPattern = /```(?:\w+)?\s*([\s\S]*?)```/g;
  while ((match = codeBlockPattern.exec(text)) !== null) {
    const code = match[1].trim();
    if (code.length > 20) {
      citations.push(code);
    }
  }

  return citations;
}

/**
 * Normalize code for comparison (remove whitespace variations)
 */
function normalizeCode(code: string): string {
  return code
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,()=])\s*/g, '$1')
    .trim()
    .toLowerCase();
}

/**
 * Check if a code citation appears in the context with strict matching
 */
function findCodeInContext(citation: string, context: string): { found: boolean; matchType: 'exact' | 'normalized' | 'partial' | 'none' } {
  // Direct substring match (best)
  if (context.includes(citation)) {
    return { found: true, matchType: 'exact' };
  }

  // Normalized match (handles whitespace differences)
  const normalizedCitation = normalizeCode(citation);
  const normalizedContext = normalizeCode(context);

  if (normalizedContext.includes(normalizedCitation)) {
    return { found: true, matchType: 'normalized' };
  }

  // Stricter partial match - require 85% token match (increased from 70%)
  const citationTokens = normalizedCitation.split(/\s+/).filter(t => t.length > 2);
  if (citationTokens.length >= 3) {
    let matchCount = 0;
    for (const token of citationTokens) {
      if (normalizedContext.includes(token)) {
        matchCount++;
      }
    }
    const matchRatio = matchCount / citationTokens.length;
    if (matchRatio >= 0.85) {
      return { found: true, matchType: 'partial' };
    }
  }

  return { found: false, matchType: 'none' };
}

export function verifyCodeCitations(
  evidence: string,
  context: VerificationContext
): HallucinationCheck[] {
  const checks: HallucinationCheck[] = [];
  const citations = extractCodeCitations(evidence);

  for (const citation of citations) {
    const result = findCodeInContext(citation, context.codeContext);
    const displayCitation = citation.length > 80 ? citation.substring(0, 80) + '...' : citation;

    if (!result.found) {
      checks.push({
        type: 'code_citation',
        claim: displayCitation,
        verified: false,
        details: `Code snippet not found in provided context - possible hallucination`,
        severity: 'critical',
      });
    } else if (result.matchType === 'partial') {
      checks.push({
        type: 'code_citation',
        claim: displayCitation,
        verified: true,
        details: `Code found via partial match (85%+ tokens) - verify manually`,
        severity: 'warning',
      });
    } else {
      checks.push({
        type: 'code_citation',
        claim: citation.substring(0, 50) + (citation.length > 50 ? '...' : ''),
        verified: true,
        details: `Code found in context (${result.matchType} match)`,
        severity: 'info',
      });
    }
  }

  return checks;
}

// ============================================
// Line Reference Verification
// ============================================

/**
 * Extract file:line references from text
 */
function extractLineReferences(text: string): Array<{ file: string; line: number }> {
  const references: Array<{ file: string; line: number }> = [];

  // Pattern: filename.ext:123 or filename.ext:line 123
  const patterns = [
    /([a-zA-Z0-9_-]+\.[a-zA-Z]+):(\d+)/g,
    /([a-zA-Z0-9_-]+\.[a-zA-Z]+):\s*line\s*(\d+)/gi,
    /line\s*(\d+)\s*(?:of|in)\s*([a-zA-Z0-9_-]+\.[a-zA-Z]+)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const file = match[1].includes('.') ? match[1] : match[2];
      const lineStr = match[1].includes('.') ? match[2] : match[1];
      const line = parseInt(lineStr, 10);

      if (!isNaN(line) && line > 0 && line < 100000) {
        references.push({ file, line });
      }
    }
  }

  return references;
}

export function verifyLineReferences(
  explanation: string,
  evidence: string,
  context: VerificationContext
): HallucinationCheck[] {
  const checks: HallucinationCheck[] = [];
  const allText = explanation + '\n' + evidence;
  const references = extractLineReferences(allText);

  const uniqueRefs = references.filter(
    (ref, idx, arr) =>
      arr.findIndex(r => r.file === ref.file && r.line === ref.line) === idx
  );

  for (const ref of uniqueRefs) {
    const matchingFile = context.relevantFiles.find(f => f.endsWith(ref.file) || f.includes(ref.file));

    if (!matchingFile) {
      checks.push({
        type: 'line_reference',
        claim: `${ref.file}:${ref.line}`,
        verified: false,
        details: `File "${ref.file}" not found in context`,
        severity: 'warning',
      });
      continue;
    }

    try {
      const content = fs.readFileSync(matchingFile, 'utf-8');
      const lines = content.split('\n');

      if (ref.line > lines.length) {
        checks.push({
          type: 'line_reference',
          claim: `${ref.file}:${ref.line}`,
          verified: false,
          details: `Line ${ref.line} exceeds file length (${lines.length} lines)`,
          severity: 'critical',
        });
      } else {
        const actualLineContent = lines[ref.line - 1]?.trim() || '';
        const lineContextWindow = lines.slice(Math.max(0, ref.line - 3), ref.line + 2).join(' ');
        
        const contentMentionedInExplanation = checkLineContentMentioned(
          actualLineContent,
          lineContextWindow,
          allText
        );

        if (contentMentionedInExplanation) {
          checks.push({
            type: 'line_reference',
            claim: `${ref.file}:${ref.line}`,
            verified: true,
            details: `Line content matches explanation: "${actualLineContent.substring(0, 60)}..."`,
            severity: 'info',
          });
        } else {
          checks.push({
            type: 'line_reference',
            claim: `${ref.file}:${ref.line}`,
            verified: true,
            details: `Line exists but content not mentioned in explanation. Actual: "${actualLineContent.substring(0, 60)}..."`,
            severity: 'warning',
          });
        }
      }
    } catch {
      checks.push({
        type: 'line_reference',
        claim: `${ref.file}:${ref.line}`,
        verified: false,
        details: `Could not read file to verify line number`,
        severity: 'warning',
      });
    }
  }

  return checks;
}

function checkLineContentMentioned(
  lineContent: string,
  contextWindow: string,
  explanationText: string
): boolean {
  const normalizedExplanation = explanationText.toLowerCase();
  const normalizedLine = lineContent.toLowerCase().trim();
  const normalizedContext = contextWindow.toLowerCase();
  
  if (normalizedLine.length < 5) return true;
  
  if (normalizedExplanation.includes(normalizedLine)) return true;
  
  const significantTokens = normalizedLine
    .split(/[\s\(\)\{\}\[\];,=<>]+/)
    .filter(t => t.length > 3 && !/^(const|let|var|function|return|if|else|for|while|import|export|from|async|await)$/.test(t));
  
  if (significantTokens.length === 0) return true;
  
  const matchedTokens = significantTokens.filter(t => normalizedExplanation.includes(t));
  const matchRatio = matchedTokens.length / significantTokens.length;
  
  if (matchRatio >= 0.5) return true;
  
  const contextTokens = normalizedContext
    .split(/[\s\(\)\{\}\[\];,=<>]+/)
    .filter(t => t.length > 4);
  const contextMatches = contextTokens.filter(t => normalizedExplanation.includes(t));
  
  return contextMatches.length >= 3;
}

// ============================================
// Symbol Existence Verification
// ============================================

/**
 * Extract function/class names from text
 */
function extractSymbolReferences(text: string): string[] {
  const symbols: string[] = [];

  // Function calls: functionName(
  const funcPattern = /\b([a-z][a-zA-Z0-9]*)\s*\(/g;
  let match;
  while ((match = funcPattern.exec(text)) !== null) {
    const name = match[1];
    // Filter common words and JS built-ins
    if (
      name.length > 2 &&
      !['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'new', 'typeof'].includes(
        name
      )
    ) {
      symbols.push(name);
    }
  }

  // Class/Component names: PascalCase
  const classPattern = /\b([A-Z][a-zA-Z0-9]+)\b/g;
  while ((match = classPattern.exec(text)) !== null) {
    const name = match[1];
    // Filter common types
    if (
      !['Error', 'Promise', 'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'Map', 'Set'].includes(
        name
      )
    ) {
      symbols.push(name);
    }
  }

  // Deduplicate
  return Array.from(new Set(symbols));
}

/**
 * Verify that mentioned symbols exist in the code context
 */
export function verifySymbolReferences(
  explanation: string,
  context: VerificationContext
): HallucinationCheck[] {
  const checks: HallucinationCheck[] = [];
  const symbols = extractSymbolReferences(explanation);

  // Only check symbols that appear to be specific (mentioned multiple times or in code blocks)
  const significantSymbols = symbols.filter(s => {
    const count = (explanation.match(new RegExp(`\\b${s}\\b`, 'g')) || []).length;
    return count >= 2 || explanation.includes(`\`${s}\``);
  });

  for (const symbol of significantSymbols.slice(0, 10)) {
    // Limit to 10 symbols
    const pattern = new RegExp(`\\b${symbol}\\b`);
    const found = pattern.test(context.codeContext);

    if (!found) {
      checks.push({
        type: 'symbol',
        claim: symbol,
        verified: false,
        details: `Symbol "${symbol}" not found in provided code context`,
        severity: 'warning',
      });
    }
  }

  return checks;
}

// ============================================
// Main Verification Function
// ============================================

/**
 * Perform comprehensive hallucination check on analysis results
 */
export function checkForHallucinations(
  analysis: AnalysisToVerify,
  context: VerificationContext
): HallucinationCheckResult {
  const allChecks: HallucinationCheck[] = [];

  // 1. Verify file existence
  const fileChecks = verifyFileExistence(analysis.rootCause.affectedFiles, context);
  allChecks.push(...fileChecks);

  // 2. Verify code citations in evidence
  const citationChecks = verifyCodeCitations(analysis.codeVerification.evidence, context);
  allChecks.push(...citationChecks);

  // 3. Verify line references
  const lineChecks = verifyLineReferences(
    analysis.rootCause.explanation,
    analysis.codeVerification.evidence,
    context
  );
  allChecks.push(...lineChecks);

  // 4. Verify symbol references
  const symbolChecks = verifySymbolReferences(analysis.rootCause.explanation, context);
  allChecks.push(...symbolChecks);

  // 5. Verify files in code changes
  for (const change of analysis.suggestedFix.codeChanges) {
    const changeFileChecks = verifyFileExistence([change.file], context);
    allChecks.push(...changeFileChecks);

    // Verify "before" code exists
    if (change.before) {
      const beforeFound = findCodeInContext(change.before, context.codeContext);
      if (!beforeFound) {
        allChecks.push({
          type: 'code_citation',
          claim: `Before code in ${change.file}`,
          verified: false,
          details: `"Before" code snippet not found - fix may be based on incorrect assumption`,
          severity: 'critical',
        });
      }
    }
  }

  // Calculate score
  const criticalFails = allChecks.filter(c => !c.verified && c.severity === 'critical').length;
  const warningFails = allChecks.filter(c => !c.verified && c.severity === 'warning').length;
  const totalChecks = allChecks.length;

  let score = 100;
  if (totalChecks > 0) {
    score -= criticalFails * 25; // -25 per critical failure
    score -= warningFails * 10; // -10 per warning failure
    score = Math.max(0, Math.min(100, score));
  }

  // Generate summary
  const failedChecks = allChecks.filter(c => !c.verified);
  let summary: string;

  if (failedChecks.length === 0) {
    summary = '✅ All claims verified against code context';
  } else if (criticalFails > 0) {
    summary = `🔴 ${criticalFails} critical hallucination(s) detected: LLM referenced non-existent code`;
  } else {
    summary = `⚠️ ${warningFails} unverified claim(s): Some references could not be confirmed`;
  }

  return {
    isValid: criticalFails === 0,
    score,
    checks: allChecks,
    summary,
  };
}

/**
 * Apply hallucination penalties to confidence score
 */
export function applyHallucinationPenalty(
  originalConfidence: number,
  hallucinationResult: HallucinationCheckResult
): { confidence: number; penalties: string[] } {
  let confidence = originalConfidence;
  const penalties: string[] = [];

  const criticalFails = hallucinationResult.checks.filter(
    c => !c.verified && c.severity === 'critical'
  );
  const warningFails = hallucinationResult.checks.filter(
    c => !c.verified && c.severity === 'warning'
  );

  // Critical failures: Cap confidence at 30%
  if (criticalFails.length > 0) {
    confidence = Math.min(confidence, 30);
    penalties.push(
      `🔴 Hallucination detected: ${criticalFails.length} critical unverified claim(s) (capped at 30%)`
    );

    // Add specific failures
    for (const fail of criticalFails.slice(0, 3)) {
      penalties.push(`   - ${fail.type}: ${fail.claim}`);
    }
  }

  // Warning failures: -10% per warning (max -30%)
  if (warningFails.length > 0) {
    const penalty = Math.min(warningFails.length * 10, 30);
    confidence -= penalty;
    penalties.push(`⚠️ ${warningFails.length} unverified reference(s) (-${penalty}%)`);
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  return { confidence, penalties };
}

/**
 * Format hallucination check results for display
 */
export function formatHallucinationReport(result: HallucinationCheckResult): string {
  const lines: string[] = [];

  lines.push('## 🔍 Hallucination Check Report');
  lines.push('');
  lines.push(`**Status:** ${result.summary}`);
  lines.push(`**Verification Score:** ${result.score}/100`);
  lines.push('');

  const failedChecks = result.checks.filter(c => !c.verified);
  if (failedChecks.length > 0) {
    lines.push('### ❌ Failed Verifications');
    lines.push('');
    for (const check of failedChecks) {
      const icon = check.severity === 'critical' ? '🔴' : '⚠️';
      lines.push(`${icon} **${check.type}**: \`${check.claim}\``);
      lines.push(`   ${check.details}`);
      lines.push('');
    }
  }

  const passedChecks = result.checks.filter(c => c.verified);
  if (passedChecks.length > 0) {
    lines.push('<details>');
    lines.push(`<summary>✅ Passed Verifications (${passedChecks.length})</summary>`);
    lines.push('');
    for (const check of passedChecks) {
      lines.push(`- **${check.type}**: \`${check.claim}\``);
    }
    lines.push('</details>');
  }

  return lines.join('\n');
}
