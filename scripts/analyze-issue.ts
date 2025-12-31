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

// ============================================
// Type Definitions
// ============================================

type AIProvider = 'anthropic' | 'openai' | 'google';

interface AnalysisConfig {
  provider: AIProvider;
  issueNumber: number;
  owner: string;
  repo: string;
  maxFiles: number;
  maxTokens: number;
  retryAttempts: number;
  retryDelay: number;
}

// Structured output schema for analysis
const AnalysisResultSchema = z.object({
  // Validity check - MUST be evaluated first
  isValidReport: z.boolean().describe('Whether this is a valid, actionable bug report with sufficient information'),
  invalidReason: z.string().optional().describe('If isValidReport is false, explain why (e.g., "No error logs or reproduction steps provided", "Description too vague to analyze")'),

  severity: z.enum(['critical', 'high', 'medium', 'low', 'none']),
  category: z.enum(['runtime_error', 'logic_error', 'performance', 'security', 'ui_ux', 'configuration', 'invalid_report', 'unknown']),
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
});

type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// ============================================
// Configuration
// ============================================

const config: AnalysisConfig = {
  provider: (process.env['AI_PROVIDER'] as AIProvider) || 'anthropic',
  issueNumber: parseInt(process.env['ISSUE_NUMBER'] || '0', 10),
  owner: process.env['REPO_OWNER'] || '',
  repo: process.env['REPO_NAME'] || '',
  maxFiles: parseInt(process.env['MAX_FILES'] || '25', 10),
  maxTokens: parseInt(process.env['MAX_TOKENS'] || '4000', 10),
  retryAttempts: 3,
  retryDelay: 2000,
};

// ============================================
// Model Selection
// ============================================

function getModel() {
  switch (config.provider) {
    case 'openai':
      console.log('📦 Using OpenAI GPT-4o');
      return openai('gpt-4o');
    case 'google':
      console.log('📦 Using Google Gemini 2.0 Flash');
      return google('gemini-2.0-flash');
    case 'anthropic':
    default:
      console.log('📦 Using Anthropic Claude Sonnet 4');
      return anthropic('claude-sonnet-4-20250514');
  }
}

// ============================================
// Security: Enhanced Data Masking
// ============================================

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  // Email addresses
  [/\b[\w.-]+@[\w.-]+\.\w{2,4}\b/gi, '[EMAIL]'],
  // Bearer tokens
  [/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer [TOKEN]'],
  // OpenAI keys
  [/sk-[a-zA-Z0-9]{20,}/g, '[OPENAI_KEY]'],
  // Anthropic keys
  [/sk-ant-[a-zA-Z0-9\-]{20,}/g, '[ANTHROPIC_KEY]'],
  // GitHub tokens
  [/gh[pousr]_[a-zA-Z0-9]{36,}/g, '[GITHUB_TOKEN]'],
  // AWS keys
  [/AKIA[A-Z0-9]{16}/g, '[AWS_KEY]'],
  // JWT tokens
  [/eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_.+/=]*/g, '[JWT]'],
  // Generic secrets
  [/(?:password|passwd|pwd|secret|token|apikey|api_key|private_key)[=:\s]+["']?[^\s"']{8,}["']?/gi, '[REDACTED]'],
  // Database URLs
  [/(?:mongodb|mysql|postgresql|postgres|redis):\/\/[^\s"']+/gi, '[DATABASE_URL]'],
  // IP addresses
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]'],
  // Credit card numbers
  [/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD_NUMBER]'],
];

function maskSensitiveData(text: string): string {
  let masked = text;
  for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

// ============================================
// Smart File Discovery
// ============================================

interface FileInfo {
  path: string;
  size: number;
  relevanceScore: number;
}

function findRelevantFiles(
  dir: string,
  keywords: string[],
  extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.kt'],
  ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__', 'vendor']
): FileInfo[] {
  const files: FileInfo[] = [];

  function calculateRelevance(filePath: string): number {
    let score = 0;
    const lowerPath = filePath.toLowerCase();

    // Keyword matching
    for (const keyword of keywords) {
      if (lowerPath.includes(keyword.toLowerCase())) {
        score += 15;
      }
    }

    // File type priorities
    if (lowerPath.includes('error') || lowerPath.includes('exception')) score += 10;
    if (lowerPath.includes('handler') || lowerPath.includes('controller')) score += 8;
    if (lowerPath.includes('api/') || lowerPath.includes('route')) score += 7;
    if (lowerPath.includes('page.tsx') || lowerPath.includes('page.ts')) score += 6;
    if (lowerPath.includes('component')) score += 5;
    if (lowerPath.includes('hook') || lowerPath.includes('use')) score += 4;
    if (lowerPath.includes('util') || lowerPath.includes('lib') || lowerPath.includes('helper')) score += 3;
    if (lowerPath.includes('service') || lowerPath.includes('client')) score += 3;
    if (lowerPath.includes('config') || lowerPath.includes('setting')) score += 2;

    // Penalize test files for bug analysis
    if (lowerPath.includes('.test.') || lowerPath.includes('.spec.') || lowerPath.includes('__test__')) {
      score -= 5;
    }

    return score;
  }

  function walk(currentDir: string, depth = 0): void {
    if (depth > 6) return;

    try {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);

        if (item.isDirectory()) {
          if (!item.name.startsWith('.') && !ignoreDirs.includes(item.name)) {
            walk(fullPath, depth + 1);
          }
        } else if (item.isFile()) {
          if (extensions.some((ext) => item.name.endsWith(ext))) {
            try {
              const stats = fs.statSync(fullPath);
              files.push({
                path: fullPath,
                size: stats.size,
                relevanceScore: calculateRelevance(fullPath),
              });
            } catch {
              // Skip files we can't stat
            }
          }
        }

        if (files.length >= 100) return; // Cap at 100 files for performance
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);

  // Sort by relevance and return top files
  return files
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, config.maxFiles);
}

// ============================================
// Context Extraction
// ============================================

function extractKeywords(text: string): string[] {
  const keywords: string[] = [];

  // File paths
  const filePathPattern = /(?:[\w-]+\/)*[\w-]+\.(ts|tsx|js|jsx|py|go|rs|java|kt)/g;
  keywords.push(...(text.match(filePathPattern) || []));

  // Error types and messages
  const errorPattern = /(?:Error|Exception|TypeError|ReferenceError|SyntaxError|RuntimeError|NullPointerException):\s*[^\n]+/g;
  const errors = text.match(errorPattern) || [];
  keywords.push(...errors.map((e) => e.split(':')[0] || ''));

  // Function/class names (PascalCase or camelCase)
  const identifierPattern = /\b[A-Z][a-zA-Z0-9]{2,}\b|\b[a-z]+[A-Z][a-zA-Z0-9]*\b/g;
  keywords.push(...(text.match(identifierPattern) || []).slice(0, 15));

  // Stack trace file references
  const stackPattern = /at\s+(?:[\w.]+\s+)?\(?([^:)]+):\d+:\d+\)?/g;
  let match;
  while ((match = stackPattern.exec(text)) !== null) {
    if (match[1]) keywords.push(path.basename(match[1]));
  }

  return [...new Set(keywords)];
}

function readFileWithContext(filePath: string, maxChars = 4000): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // If file is small enough, return all
    if (content.length <= maxChars) {
      return `### ${filePath} (${totalLines} lines)\n\`\`\`\n${content}\n\`\`\``;
    }

    // Otherwise, try to include important parts
    const truncated = content.slice(0, maxChars);
    const truncatedLines = truncated.split('\n').length;

    return `### ${filePath} (showing ${truncatedLines}/${totalLines} lines)\n\`\`\`\n${truncated}\n... (truncated)\n\`\`\``;
  } catch {
    return '';
  }
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
- If you cannot find evidence of a bug, say so honestly`;

const USER_PROMPT_TEMPLATE = (
  title: string,
  body: string,
  codeContext: string,
  keywords: string[]
) => `Analyze this bug report using the Chain-of-Thought methodology:

## Bug Report

### Title
${title}

### Description
${body}

### Extracted Keywords
${keywords.join(', ')}

## Code Context
${codeContext || 'No relevant code files found in the repository.'}

---

Please analyze this bug step-by-step following the methodology, then provide your structured analysis.`;

// ============================================
// Retry Logic
// ============================================

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delayMs: number
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`⚠️ Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}`);

      if (attempt < maxAttempts) {
        const waitTime = delayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

// ============================================
// Analysis Result Formatting
// ============================================

function formatAnalysisComment(result: AnalysisResult, provider: string, filesAnalyzed: number): string {
  // Handle invalid reports first
  if (!result.isValidReport) {
    return `## 🔍 inner-lens Analysis

⚪ **Report Status:** INSUFFICIENT INFORMATION

---

### ❓ Unable to Analyze

This bug report does not contain enough information for automated analysis.

**Reason:** ${result.invalidReason || 'The report lacks sufficient details, error logs, or reproduction steps.'}

---

### 📝 What We Need

To analyze this issue, please provide:

1. **Error messages or stack traces** - Copy the exact error from the console
2. **Steps to reproduce** - What actions lead to this bug?
3. **Expected vs actual behavior** - What should happen vs what actually happens?
4. **Console logs** - Enable log capture in inner-lens widget

---

### 🔄 Next Steps

- **Update this issue** with more details, OR
- **Submit a new report** with the inner-lens widget (ensure console logging is enabled)

---

<details>
<summary>Analysis Metadata</summary>

| Field | Value |
|-------|-------|
| Status | Invalid/Insufficient |
| Provider | ${provider} |
| Files Scanned | ${filesAnalyzed} |
| Timestamp | ${new Date().toISOString()} |

</details>

*This analysis was generated by [inner-lens](https://github.com/jhlee0409/inner-lens).*`;
  }

  const severityEmoji: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
    none: '⚪',
  };

  const categoryLabels: Record<string, string> = {
    runtime_error: 'Runtime Error',
    logic_error: 'Logic Error',
    performance: 'Performance Issue',
    security: 'Security Issue',
    ui_ux: 'UI/UX Issue',
    configuration: 'Configuration Issue',
    invalid_report: 'Invalid Report',
    unknown: 'Unknown',
  };

  const codeChangesSection = result.suggestedFix.codeChanges
    .map((change) => {
      let section = `#### 📄 \`${change.file}\`\n${change.description}\n`;
      if (change.before) {
        section += `\n**Before:**\n\`\`\`\n${change.before}\n\`\`\`\n`;
      }
      section += `\n**After:**\n\`\`\`\n${change.after}\n\`\`\``;
      return section;
    })
    .join('\n\n');

  return `## 🔍 inner-lens Analysis

${severityEmoji[result.severity]} **Severity:** ${result.severity.toUpperCase()} | **Category:** ${categoryLabels[result.category]} | **Confidence:** ${result.confidence}%

---

### 🎯 Root Cause

**${result.rootCause.summary}**

${result.rootCause.explanation}

${result.rootCause.affectedFiles.length > 0 ? `**Affected Files:** ${result.rootCause.affectedFiles.map(f => `\`${f}\``).join(', ')}` : ''}

---

### 🔧 Suggested Fix

${result.suggestedFix.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

${codeChangesSection ? `\n#### Code Changes\n\n${codeChangesSection}` : ''}

---

### 🛡️ Prevention

${result.prevention.map((p) => `- ${p}`).join('\n')}

${result.additionalContext ? `\n---\n\n### 📝 Additional Notes\n\n${result.additionalContext}` : ''}

---

<details>
<summary>Analysis Metadata</summary>

| Field | Value |
|-------|-------|
| Provider | ${provider} |
| Files Analyzed | ${filesAnalyzed} |
| Timestamp | ${new Date().toISOString()} |
| Confidence | ${result.confidence}% |

</details>

*This analysis was generated by [inner-lens](https://github.com/jhlee0409/inner-lens). Always verify suggestions before applying.*`;
}

// ============================================
// Main Analysis Function
// ============================================

async function analyzeIssue(): Promise<void> {
  console.log('🔍 inner-lens Analysis Engine v2 Starting...\n');
  console.log(`📋 Issue: ${config.owner}/${config.repo}#${config.issueNumber}`);
  console.log(`🤖 Provider: ${config.provider}`);

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

  // Step 2: Extract keywords
  console.log('\n🔑 Step 2: Extracting keywords...');
  const keywords = extractKeywords(`${issue.title} ${issue.body || ''}`);
  console.log(`   Found ${keywords.length} keywords: ${keywords.slice(0, 5).join(', ')}...`);

  // Step 3: Find relevant files
  console.log('\n📂 Step 3: Finding relevant files...');
  const relevantFiles = findRelevantFiles('.', keywords);
  console.log(`   Found ${relevantFiles.length} relevant files`);

  if (relevantFiles.length > 0) {
    console.log('   Top 5 by relevance:');
    relevantFiles.slice(0, 5).forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.path} (score: ${f.relevanceScore})`);
    });
  }

  // Step 4: Build code context
  console.log('\n📖 Step 4: Building code context...');
  const codeContext = relevantFiles
    .slice(0, 15)
    .map((f) => readFileWithContext(f.path, 3000))
    .filter(Boolean)
    .join('\n\n');

  const contextSize = codeContext.length;
  console.log(`   Context size: ${(contextSize / 1024).toFixed(1)} KB`);

  // Step 5: Generate analysis with retry
  console.log('\n🤖 Step 5: Generating AI analysis...');
  const model = getModel();

  const userPrompt = USER_PROMPT_TEMPLATE(maskedTitle, maskedBody, codeContext, keywords);

  let analysis: AnalysisResult;

  try {
    // Try structured output first
    const result = await withRetry(
      async () => {
        const { object } = await generateObject({
          model,
          schema: AnalysisResultSchema,
          system: SYSTEM_PROMPT,
          prompt: userPrompt,
          maxTokens: config.maxTokens,
        });
        return object;
      },
      config.retryAttempts,
      config.retryDelay
    );
    analysis = result;
    console.log('   ✅ Structured analysis generated');
  } catch (structuredError) {
    // Fallback to text generation if structured fails
    console.log('   ⚠️ Structured output failed, falling back to text generation...');

    const { text } = await withRetry(
      async () =>
        generateText({
          model,
          system: SYSTEM_PROMPT,
          prompt: userPrompt + '\n\nProvide your analysis in a structured format.',
          maxTokens: config.maxTokens,
        }),
      config.retryAttempts,
      config.retryDelay
    );

    // Create a basic structured result from text
    analysis = {
      isValidReport: true, // Assume valid if we got this far
      severity: 'medium',
      category: 'unknown',
      rootCause: {
        summary: 'Analysis generated from unstructured response',
        explanation: text,
        affectedFiles: relevantFiles.slice(0, 3).map((f) => f.path),
      },
      suggestedFix: {
        steps: ['Review the analysis above', 'Identify the specific changes needed', 'Implement and test the fix'],
        codeChanges: [],
      },
      prevention: ['Add automated tests for this scenario', 'Consider adding error handling'],
      confidence: 50,
      additionalContext: 'This analysis was generated using fallback text mode. Structured output was not available.',
    };
    console.log('   ✅ Fallback analysis generated');
  }

  // Step 6: Post comment
  console.log('\n💬 Step 6: Posting analysis comment...');

  const commentBody = formatAnalysisComment(analysis, config.provider, relevantFiles.length);

  await octokit.issues.createComment({
    owner: config.owner,
    repo: config.repo,
    issue_number: config.issueNumber,
    body: commentBody,
  });

  // Step 7: Add labels based on analysis
  console.log('\n🏷️ Step 7: Adding labels...');
  const labelsToAdd: string[] = [];

  // Handle invalid reports
  if (!analysis.isValidReport) {
    labelsToAdd.push('needs-more-info');
    console.log('   📋 Report marked as invalid/insufficient');
  } else {
    // Only add severity/confidence labels for valid reports
    if (analysis.severity === 'critical' || analysis.severity === 'high') {
      labelsToAdd.push('priority:high');
    }
    if (analysis.category === 'security') {
      labelsToAdd.push('security');
    }
    if (analysis.confidence >= 80) {
      labelsToAdd.push('ai:high-confidence');
    }
  }

  if (labelsToAdd.length > 0) {
    try {
      await octokit.issues.addLabels({
        owner: config.owner,
        repo: config.repo,
        issue_number: config.issueNumber,
        labels: labelsToAdd,
      });
      console.log(`   Added labels: ${labelsToAdd.join(', ')}`);
    } catch {
      console.log('   ⚠️ Could not add labels (may not exist in repo)');
    }
  }

  console.log('\n✅ Analysis complete!');
  console.log(`🔗 https://github.com/${config.owner}/${config.repo}/issues/${config.issueNumber}`);
}

// ============================================
// Execute
// ============================================

analyzeIssue().catch((error) => {
  console.error('\n❌ Analysis failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
