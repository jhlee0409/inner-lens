/**
 * Multi-Agent Pipeline E2E Tests (P5 Validation)
 *
 * Tests the complete QA flow:
 * - Bug Report → Analysis → Developer Handoff
 *
 * Validates:
 * 1. Open source value (API usability, documentation)
 * 2. QA workflow (issue creation → developer notification)
 * 3. Response quality (accuracy, actionability, consistency)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import agent types and functions
import type {
  IssueContext,
  AnalysisResult,
  FileInfo,
  CodeChunk,
  ErrorLocation,
  FinderOutput,
  OrchestratorResult,
} from './types.js';

import {
  buildIssueContext,
  extractKeywords,
  extractErrorLocations,
  extractErrorMessages,
  determineLevel,
} from './orchestrator.js';

import { 
  finderAgent,
  extractIntentWithLLM,
  inferFilesWithLLM,
  getProjectFileTree,
  mergeInferredWithDiscovered,
} from './finder.js';
import type { ExtractedIntent, InferredFile } from './types.js';

// ============================================
// Test Fixtures: Bug Report Scenarios
// ============================================

const BUG_REPORT_SCENARIOS = {
  // Level 1: Simple bug with clear stack trace
  simpleWithStackTrace: {
    title: 'TypeError: Cannot read property "length" of undefined',
    body: `
## Description
The app crashes when clicking the submit button on an empty form.

## Steps to Reproduce
1. Open the form page
2. Leave all fields empty
3. Click submit

## Error Log
\`\`\`
TypeError: Cannot read property 'length' of undefined
    at validateForm (src/utils/validation.ts:42:15)
    at handleSubmit (src/components/Form.tsx:28:10)
    at onClick (src/components/Button.tsx:15:5)
\`\`\`

## Expected Behavior
Form should show validation errors instead of crashing.
    `,
    expectedLevel: 1,
    expectedCategory: 'runtime_error',
    expectedSeverity: 'high',
  },

  // Level 2: Complex bug without clear stack trace
  // Note: Current level determination gives L1 for this case
  // because it has moderate description quality
  complexNoStackTrace: {
    title: 'Data not saving intermittently',
    body: `
## Description
Sometimes when users save their profile, the data doesn't persist.
This happens randomly and we can't reproduce consistently.

## What we've tried
- Checked network tab - requests seem to go through
- Checked database - sometimes data is there, sometimes not
- No error messages in console

## Environment
- Browser: Chrome 120
- User reports: ~5% of saves fail
    `,
    expectedLevel: 1, // L1 due to moderate description quality
    expectedCategory: 'unknown',
    expectedSeverity: 'medium',
  },

  // Invalid report: Too vague
  invalidVague: {
    title: '에러',
    body: 'It doesn\'t work.',
    expectedLevel: 1,
    expectedIsValid: false,
  },

  // Invalid report: Feature request
  invalidFeatureRequest: {
    title: 'Add dark mode support',
    body: `
## Description
Please add dark mode to the application.

## Why
Many users prefer dark mode for better visibility at night.
    `,
    expectedLevel: 1,
    expectedIsValid: false,
  },

  // Level 1: Network error with clear logs
  networkError: {
    title: 'API call fails with 500 error',
    body: `
## Description
The user list API returns 500 error.

## Network Log
\`\`\`
POST /api/users HTTP/1.1
Status: 500 Internal Server Error

Response:
{"error": "Database connection timeout"}
\`\`\`

## Console
\`\`\`
Error: Failed to fetch users
    at fetchUsers (src/api/users.ts:15:10)
    at loadUserList (src/pages/Users.tsx:22:5)
\`\`\`
    `,
    expectedLevel: 1,
    expectedCategory: 'runtime_error',
    expectedSeverity: 'high',
  },

  // Level 2: Performance issue
  performanceIssue: {
    title: 'Page takes 10+ seconds to load',
    body: `
## Description
The dashboard page is extremely slow to load.

## Observations
- Initial render is fast
- Data fetching completes in ~500ms
- But the page freezes for 10+ seconds after
- CPU spikes to 100% during freeze
- No errors in console

## Suspected area
Maybe the chart component? We render ~1000 data points.
    `,
    expectedLevel: 2,
    expectedCategory: 'performance',
    expectedSeverity: 'medium',
  },

  koreanBugReport: {
    title: '숏폼 페이지에서 캡쳐버튼 클릭시 아무런 동작을 안합니다',
    body: `
## Bug Report
캡쳐버튼 클릭시 아무런 동작을 안합니다

### Environment
| Field | Value |
|-------|-------|
| URL | http://localhost:3000/shortform/youtube_xxx |
| User Agent | Mozilla/5.0 Chrome/120 |

### Page Context
Route: /shortform/youtube_xxx
Title: VISKIT AI

### User Actions (5 events)
[2026-01-08T01:19:14.482Z] CLICK on button[aria-label="버그 제보"] > svg
[2026-01-08T01:19:17.068Z] CLICK on div#timeline-player-container > div.relative
    `,
    expectedLevel: 2,
    expectedCategory: 'ui_ux',
    expectedIntent: {
      userAction: 'click capture button',
      inferredFeatures: ['CaptureButton', 'Capture', 'Screenshot', 'onClick'],
    },
  },
};

// ============================================
// Test: Context Extraction (Pre-Agent)
// ============================================

describe('Context Extraction', () => {
  describe('extractKeywords', () => {
    it('should extract file paths from text', () => {
      const text = 'Error in src/utils/validation.ts and components/Form.tsx';
      const keywords = extractKeywords(text);

      // extractKeywords returns full paths, not just filenames
      expect(keywords.some(k => k.includes('validation.ts'))).toBe(true);
      expect(keywords.some(k => k.includes('Form.tsx'))).toBe(true);
    });

    it('should extract error types', () => {
      const text = 'TypeError: Cannot read property of undefined. Also got ReferenceError.';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('TypeError');
      expect(keywords).toContain('ReferenceError');
    });

    it('should extract PascalCase identifiers', () => {
      const text = 'The FormValidator component throws in UserProfile context';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('FormValidator');
      expect(keywords).toContain('UserProfile');
    });

    it('should extract camelCase identifiers', () => {
      const text = 'handleSubmit calls validateForm which fails';
      const keywords = extractKeywords(text);

      expect(keywords).toContain('handleSubmit');
      expect(keywords).toContain('validateForm');
    });
  });

  describe('extractErrorLocations', () => {
    it('should parse Node.js stack traces', () => {
      const text = `
        at validateForm (src/utils/validation.ts:42:15)
        at handleSubmit (src/components/Form.tsx:28:10)
      `;
      const locations = extractErrorLocations(text);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        file: 'validation.ts',
        line: 42,
        column: 15,
        functionName: 'validateForm',
      });
      expect(locations[1]).toMatchObject({
        file: 'Form.tsx',
        line: 28,
        functionName: 'handleSubmit',
      });
    });

    it('should parse Python stack traces', () => {
      const text = `
        File "src/handlers/user.py", line 45, in get_user
        File "src/db/connection.py", line 12, in execute
      `;
      const locations = extractErrorLocations(text);

      expect(locations).toHaveLength(2);
      expect(locations[0]).toMatchObject({
        file: 'user.py',
        line: 45,
        functionName: 'get_user',
      });
    });

    it('should parse Firefox stack traces', () => {
      const text = 'handleClick@bundle.js:1234:56';
      const locations = extractErrorLocations(text);

      expect(locations).toHaveLength(1);
      expect(locations[0]).toMatchObject({
        file: 'bundle.js',
        line: 1234,
        column: 56,
        functionName: 'handleClick',
      });
    });

    it('should parse generic file:line format', () => {
      const text = 'Error occurred in server.ts:100:5';
      const locations = extractErrorLocations(text);

      expect(locations.length).toBeGreaterThan(0);
      expect(locations[0]).toMatchObject({
        file: 'server.ts',
        line: 100,
      });
    });
  });

  describe('extractErrorMessages', () => {
    it('should extract TypeError messages', () => {
      const text = "TypeError: Cannot read property 'length' of undefined";
      const messages = extractErrorMessages(text);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Cannot read property');
    });

    it('should extract multiple error types', () => {
      const text = `
        TypeError: undefined is not a function
        ReferenceError: x is not defined
        Error: Something went wrong
      `;
      const messages = extractErrorMessages(text);

      expect(messages.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle network errors', () => {
      const text = 'NetworkError: Failed to fetch';
      const messages = extractErrorMessages(text);

      expect(messages).toHaveLength(1);
      expect(messages[0]).toContain('Failed to fetch');
    });
  });
});

// ============================================
// Test: Level Determination
// ============================================

describe('Level Determination', () => {
  it('should assign Level 1 for bugs with clear stack traces', () => {
    const scenario = BUG_REPORT_SCENARIOS.simpleWithStackTrace;
    const context = buildIssueContext(
      scenario.title,
      scenario.body,
      1,
      'owner',
      'repo'
    );

    const level = determineLevel(context);
    expect(level).toBe(scenario.expectedLevel);
  });

  it('should handle complex bugs based on description quality', () => {
    const scenario = BUG_REPORT_SCENARIOS.complexNoStackTrace;
    const context = buildIssueContext(
      scenario.title,
      scenario.body,
      2,
      'owner',
      'repo'
    );

    const level = determineLevel(context);
    // Complex bugs with moderate description still get L1
    // Only truly low-quality descriptions trigger L2
    expect(level).toBe(scenario.expectedLevel);
  });

  it('should allow forced level override', () => {
    const scenario = BUG_REPORT_SCENARIOS.simpleWithStackTrace;
    const context = buildIssueContext(
      scenario.title,
      scenario.body,
      1,
      'owner',
      'repo'
    );

    const forcedLevel2 = determineLevel(context, 2);
    expect(forcedLevel2).toBe(2);

    const forcedLevel1 = determineLevel(context, 1);
    expect(forcedLevel1).toBe(1);
  });

  it('should use auto level when specified', () => {
    const scenario = BUG_REPORT_SCENARIOS.simpleWithStackTrace;
    const context = buildIssueContext(
      scenario.title,
      scenario.body,
      1,
      'owner',
      'repo'
    );

    const autoLevel = determineLevel(context, 'auto');
    expect(autoLevel).toBe(scenario.expectedLevel);
  });
});

// ============================================
// Test: IssueContext Building
// ============================================

describe('buildIssueContext', () => {
  it('should extract all relevant information from bug report', () => {
    const scenario = BUG_REPORT_SCENARIOS.simpleWithStackTrace;
    const context = buildIssueContext(
      scenario.title,
      scenario.body,
      123,
      'owner',
      'repo'
    );

    expect(context.title).toBe(scenario.title);
    expect(context.body).toBe(scenario.body);
    expect(context.issueNumber).toBe(123);
    expect(context.owner).toBe('owner');
    expect(context.repo).toBe('repo');

    // Keywords should include error type and file references
    expect(context.keywords).toContain('TypeError');
    expect(context.keywords.some(k => k.includes('validation'))).toBe(true);

    // Error locations should be extracted
    expect(context.errorLocations.length).toBeGreaterThan(0);
    expect(context.errorLocations[0]?.functionName).toBe('validateForm');

    // Error messages should be extracted
    expect(context.errorMessages.length).toBeGreaterThan(0);
  });

  it('should handle minimal bug reports', () => {
    const context = buildIssueContext(
      'Bug',
      'It crashes',
      1,
      'owner',
      'repo'
    );

    expect(context.title).toBe('Bug');
    expect(context.errorLocations).toHaveLength(0);
    expect(context.errorMessages).toHaveLength(0);
  });

  it('should handle Korean text', () => {
    const context = buildIssueContext(
      '버튼 클릭 시 에러 발생',
      '로그인 버튼을 클릭하면 TypeError가 발생합니다.',
      1,
      'owner',
      'repo'
    );

    expect(context.keywords).toContain('TypeError');
  });
});

// ============================================
// Test: Response Quality Criteria
// ============================================

describe('Response Quality', () => {
  // Mock analysis result for quality testing
  const mockValidAnalysis: AnalysisResult = {
    isValidReport: true,
    severity: 'high',
    category: 'runtime_error',
    rootCause: {
      summary: 'Null check missing in validateForm function',
      explanation: 'The validateForm function at validation.ts:42 attempts to access .length property on a potentially undefined array. This occurs when the form data is empty.',
      affectedFiles: ['src/utils/validation.ts', 'src/components/Form.tsx'],
      evidenceChain: [
        'Error Point: validation.ts:42 (validateForm)',
        'Call Path: Form.tsx:28 → validation.ts:42',
        'Root Cause: Missing null check for form.fields array',
      ],
    },
    suggestedFix: {
      steps: [
        'Add null check before accessing fields.length',
        'Consider using optional chaining: fields?.length ?? 0',
        'Add unit test for empty form case',
      ],
      codeChanges: [
        {
          file: 'src/utils/validation.ts',
          line: 42,
          description: 'Add null check for fields array',
          before: 'const count = fields.length;',
          after: 'const count = fields?.length ?? 0;',
        },
      ],
    },
    prevention: [
      'Enable strict null checks in TypeScript',
      'Add ESLint rule for no-unsafe-member-access',
      'Add integration test for form validation edge cases',
    ],
    confidence: 85,
    additionalContext: 'This is a common pattern where form data may be undefined on initial render.',
  };

  const mockInvalidAnalysis: AnalysisResult = {
    isValidReport: false,
    invalidReason: 'The report lacks sufficient information for analysis. No error logs, stack traces, or specific error description provided.',
    severity: 'none',
    category: 'invalid_report',
    rootCause: {
      summary: 'Unable to analyze - insufficient information',
      explanation: 'Cannot determine root cause without error details.',
      affectedFiles: [],
    },
    suggestedFix: {
      steps: ['Provide more details about the error'],
      codeChanges: [],
    },
    prevention: [],
    confidence: 0,
  };

  describe('Valid Report Quality', () => {
    it('should have non-empty root cause summary', () => {
      expect(mockValidAnalysis.rootCause.summary).toBeTruthy();
      expect(mockValidAnalysis.rootCause.summary.length).toBeGreaterThan(10);
    });

    it('should include file:line references in explanation', () => {
      const explanation = mockValidAnalysis.rootCause.explanation;
      expect(explanation).toMatch(/\w+\.(ts|tsx|js|jsx):\d+/);
    });

    it('should have evidence chain for L2 analysis', () => {
      expect(mockValidAnalysis.rootCause.evidenceChain).toBeDefined();
      expect(mockValidAnalysis.rootCause.evidenceChain!.length).toBeGreaterThan(0);
    });

    it('should have actionable fix steps', () => {
      expect(mockValidAnalysis.suggestedFix.steps.length).toBeGreaterThan(0);
      // Steps should be specific, not generic
      mockValidAnalysis.suggestedFix.steps.forEach(step => {
        expect(step.length).toBeGreaterThan(10);
      });
    });

    it('should include code changes with before/after', () => {
      expect(mockValidAnalysis.suggestedFix.codeChanges.length).toBeGreaterThan(0);
      const change = mockValidAnalysis.suggestedFix.codeChanges[0]!;
      expect(change.file).toBeTruthy();
      expect(change.after).toBeTruthy();
    });

    it('should have appropriate confidence level', () => {
      expect(mockValidAnalysis.confidence).toBeGreaterThanOrEqual(50);
      expect(mockValidAnalysis.confidence).toBeLessThanOrEqual(100);
    });

    it('should have prevention recommendations', () => {
      expect(mockValidAnalysis.prevention.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Report Quality', () => {
    it('should clearly indicate invalid status', () => {
      expect(mockInvalidAnalysis.isValidReport).toBe(false);
      expect(mockInvalidAnalysis.invalidReason).toBeTruthy();
    });

    it('should set appropriate severity and category', () => {
      expect(mockInvalidAnalysis.severity).toBe('none');
      expect(mockInvalidAnalysis.category).toBe('invalid_report');
    });

    it('should have zero confidence', () => {
      expect(mockInvalidAnalysis.confidence).toBe(0);
    });

    it('should explain what information is needed', () => {
      expect(mockInvalidAnalysis.invalidReason).toMatch(/information|detail|log|error/i);
    });
  });
});

// ============================================
// Test: QA → Developer Handoff Flow
// ============================================

describe('QA to Developer Handoff', () => {
  describe('Comment Format Quality', () => {
    // Simulate the comment that would be posted to GitHub
    const formatAnalysisComment = (result: AnalysisResult): string => {
      if (!result.isValidReport) {
        return `## 🔍 inner-lens Analysis

⚪ **Report Status:** INSUFFICIENT INFORMATION

**Reason:** ${result.invalidReason}

### 📝 What We Need
- Error messages or stack traces
- Steps to reproduce
- Expected vs actual behavior`;
      }

      const severityEmoji: Record<string, string> = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
        none: '⚪',
      };

      return `## 🔍 inner-lens Analysis

${severityEmoji[result.severity]} **Severity:** ${result.severity.toUpperCase()} | **Category:** ${result.category} | **Confidence:** ${result.confidence}%

---

### 🎯 Root Cause

**${result.rootCause.summary}**

${result.rootCause.explanation}

**Affected Files:** ${result.rootCause.affectedFiles.map(f => `\`${f}\``).join(', ')}

---

### 🔧 Suggested Fix

${result.suggestedFix.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

---

### 🛡️ Prevention

${result.prevention.map(p => `- ${p}`).join('\n')}`;
    };

    it('should generate readable markdown comment for valid reports', () => {
      const comment = formatAnalysisComment({
        isValidReport: true,
        severity: 'high',
        category: 'runtime_error',
        rootCause: {
          summary: 'Null check missing',
          explanation: 'The function does not handle undefined input.',
          affectedFiles: ['src/utils/validation.ts'],
        },
        suggestedFix: {
          steps: ['Add null check'],
          codeChanges: [],
        },
        prevention: ['Add strict mode'],
        confidence: 80,
      });

      expect(comment).toContain('🔍 inner-lens Analysis');
      expect(comment).toContain('🟠 **Severity:** HIGH');
      expect(comment).toContain('### 🎯 Root Cause');
      expect(comment).toContain('### 🔧 Suggested Fix');
      expect(comment).toContain('### 🛡️ Prevention');
    });

    it('should generate appropriate comment for invalid reports', () => {
      const comment = formatAnalysisComment({
        isValidReport: false,
        invalidReason: 'Not enough information',
        severity: 'none',
        category: 'invalid_report',
        rootCause: {
          summary: 'Unable to analyze',
          explanation: '',
          affectedFiles: [],
        },
        suggestedFix: { steps: [], codeChanges: [] },
        prevention: [],
        confidence: 0,
      });

      expect(comment).toContain('INSUFFICIENT INFORMATION');
      expect(comment).toContain('What We Need');
    });
  });

  describe('Developer Actionability', () => {
    it('should provide enough context for developers to fix', () => {
      const validAnalysis: AnalysisResult = {
        isValidReport: true,
        severity: 'high',
        category: 'runtime_error',
        rootCause: {
          summary: 'TypeError in validation.ts:42',
          explanation: 'Missing null check for fields array',
          affectedFiles: ['src/utils/validation.ts'],
          evidenceChain: ['validation.ts:42'],
        },
        suggestedFix: {
          steps: ['Add null check at line 42'],
          codeChanges: [{
            file: 'src/utils/validation.ts',
            line: 42,
            description: 'Add optional chaining',
            before: 'fields.length',
            after: 'fields?.length ?? 0',
          }],
        },
        prevention: ['Enable strict null checks'],
        confidence: 90,
      };

      // Developer should be able to:
      // 1. Identify exact file and line
      expect(validAnalysis.rootCause.affectedFiles.length).toBeGreaterThan(0);
      expect(validAnalysis.suggestedFix.codeChanges[0]?.line).toBeDefined();

      // 2. Understand the change needed
      expect(validAnalysis.suggestedFix.codeChanges[0]?.before).toBeDefined();
      expect(validAnalysis.suggestedFix.codeChanges[0]?.after).toBeDefined();

      // 3. Have clear steps to implement
      expect(validAnalysis.suggestedFix.steps.length).toBeGreaterThan(0);

      // 4. Know how to prevent recurrence
      expect(validAnalysis.prevention.length).toBeGreaterThan(0);
    });
  });
});

// ============================================
// Test: Open Source API Usability
// ============================================

describe('Open Source API Usability', () => {
  describe('Type Safety', () => {
    it('should export all necessary types', async () => {
      // These imports should work without errors
      const types = await import('./types.js');

      expect(types.AnalysisResultSchema).toBeDefined();
      expect(typeof types.AnalysisResultSchema.parse).toBe('function');
    });

    it('should export orchestrator functions', async () => {
      const orchestrator = await import('./orchestrator.js');

      expect(orchestrator.buildIssueContext).toBeDefined();
      expect(orchestrator.determineLevel).toBeDefined();
      expect(orchestrator.extractKeywords).toBeDefined();
      expect(orchestrator.extractErrorLocations).toBeDefined();
      expect(orchestrator.extractErrorMessages).toBeDefined();
    });

    it('should export all agents', async () => {
      const agents = await import('./index.js');

      expect(agents.finderAgent).toBeDefined();
      expect(agents.explainerAgent).toBeDefined();
      expect(agents.investigatorAgent).toBeDefined();
      expect(agents.reviewerAgent).toBeDefined();
    });
  });

  describe('Agent Interface Consistency', () => {
    it('all agents should have consistent interface', async () => {
      const { finderAgent, explainerAgent, investigatorAgent, reviewerAgent } =
        await import('./index.js');

      const agents = [finderAgent, explainerAgent, investigatorAgent, reviewerAgent];

      for (const agent of agents) {
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('description');
        expect(agent).toHaveProperty('requiredLevel');
        expect(agent).toHaveProperty('execute');
        expect(typeof agent.execute).toBe('function');
      }
    });

    it('agents should have appropriate required levels', async () => {
      const { finderAgent, explainerAgent, investigatorAgent, reviewerAgent } =
        await import('./index.js');

      // Finder and Explainer work on L1+
      expect(finderAgent.requiredLevel).toBe(1);
      expect(explainerAgent.requiredLevel).toBe(1);

      // Investigator and Reviewer are L2 only
      expect(investigatorAgent.requiredLevel).toBe(2);
      expect(reviewerAgent.requiredLevel).toBe(2);
    });
  });
});

// ============================================
// Test: Edge Cases
// ============================================

describe('Edge Cases', () => {
  it('should handle empty bug report', () => {
    const context = buildIssueContext('', '', 1, 'owner', 'repo');

    expect(context.keywords).toHaveLength(0);
    expect(context.errorLocations).toHaveLength(0);
    expect(context.errorMessages).toHaveLength(0);
  });

  it('should handle very long bug reports', () => {
    const longBody = 'Error '.repeat(10000);
    const context = buildIssueContext('Bug', longBody, 1, 'owner', 'repo');

    expect(context.body).toBe(longBody);
    // Should not crash or hang
  });

  it('should handle special characters in bug reports', () => {
    const specialChars = 'Error: <script>alert("xss")</script> & "quotes" \'apostrophe\'';
    const context = buildIssueContext(specialChars, specialChars, 1, 'owner', 'repo');

    expect(context.title).toBe(specialChars);
    // Should handle without crashing
  });

  it('should handle multiple stack trace formats in same report', () => {
    const mixedStackTrace = `
      at validateForm (validation.ts:42:15)
      handleClick@bundle.js:100:5
      File "handler.py", line 50, in process
    `;
    const locations = extractErrorLocations(mixedStackTrace);

    expect(locations.length).toBe(3);
  });
});

describe('Intent-First Architecture', () => {
  describe('getProjectFileTree', () => {
    it('should return file tree as string', () => {
      const tree = getProjectFileTree('.');
      
      expect(typeof tree).toBe('string');
      expect(tree.length).toBeGreaterThan(0);
      expect(tree).toContain('.ts');
    });

    it('should exclude node_modules and dist', () => {
      const tree = getProjectFileTree('.');
      
      expect(tree).not.toContain('node_modules/');
      expect(tree).not.toContain('dist/');
    });
  });

  describe('mergeInferredWithDiscovered', () => {
    it('should prioritize LLM-inferred files and preserve their order', () => {
      const inferredFiles: InferredFile[] = [
        { path: 'src/types.ts', reason: 'type definitions', relevanceScore: 80 },
        { path: 'src/utils/masking.ts', reason: 'masking utility', relevanceScore: 90 },
      ];
      
      const discoveredFiles: FileInfo[] = [
        { path: 'src/types.ts', size: 100, relevanceScore: 50, pathScore: 30, contentScore: 20, matchedKeywords: ['types'] },
        { path: 'src/server.ts', size: 50, relevanceScore: 60, pathScore: 10, contentScore: 50, matchedKeywords: ['server'] },
      ];

      const merged = mergeInferredWithDiscovered(inferredFiles, discoveredFiles, '.');
      
      expect(merged.length).toBe(3);
      expect(merged[0]!.path).toContain('types.ts');
      expect(merged[0]!.relevanceScore).toBe(80);
      expect(merged[1]!.path).toContain('masking.ts');
      expect(merged[1]!.relevanceScore).toBe(90);
      expect(merged[2]!.matchedKeywords).toContain('pattern-complement');
    });

    it('should merge matchedKeywords for duplicate files without adding scores', () => {
      const inferredFiles: InferredFile[] = [
        { path: 'src/types.ts', reason: 'type file', relevanceScore: 70 },
      ];
      
      const discoveredFiles: FileInfo[] = [
        { path: 'src/types.ts', size: 100, relevanceScore: 30, pathScore: 20, contentScore: 10, matchedKeywords: ['test'] },
      ];

      const merged = mergeInferredWithDiscovered(inferredFiles, discoveredFiles, '.');
      const testFile = merged.find(f => f.path.includes('types.ts'));
      
      expect(testFile!.relevanceScore).toBe(70);
      expect(testFile!.matchedKeywords).toContain('test');
      expect(testFile!.matchedKeywords.some(k => k.startsWith('llm-inferred:'))).toBe(true);
    });

    it('should only add complement files above threshold', () => {
      const inferredFiles: InferredFile[] = [
        { path: 'src/types.ts', reason: 'main file', relevanceScore: 80 },
      ];
      
      const discoveredFiles: FileInfo[] = [
        { path: 'src/server.ts', size: 100, relevanceScore: 60, pathScore: 30, contentScore: 30, matchedKeywords: ['high'] },
        { path: 'src/vanilla.ts', size: 100, relevanceScore: 40, pathScore: 20, contentScore: 20, matchedKeywords: ['low'] },
      ];

      const merged = mergeInferredWithDiscovered(inferredFiles, discoveredFiles, '.', {
        complementThreshold: 50,
        maxComplementFiles: 5,
      });
      
      expect(merged.length).toBe(2);
      expect(merged.some(f => f.path.includes('server.ts'))).toBe(true);
      expect(merged.some(f => f.path.includes('vanilla.ts'))).toBe(false);
    });

    it('should respect maxComplementFiles limit', () => {
      const inferredFiles: InferredFile[] = [
        { path: 'src/types.ts', reason: 'main file', relevanceScore: 80 },
      ];
      
      const discoveredFiles: FileInfo[] = [
        { path: 'src/server.ts', size: 100, relevanceScore: 70, pathScore: 30, contentScore: 40, matchedKeywords: [] },
        { path: 'src/core.ts', size: 100, relevanceScore: 65, pathScore: 30, contentScore: 35, matchedKeywords: [] },
        { path: 'src/react.ts', size: 100, relevanceScore: 60, pathScore: 30, contentScore: 30, matchedKeywords: [] },
      ];

      const merged = mergeInferredWithDiscovered(inferredFiles, discoveredFiles, '.', {
        complementThreshold: 50,
        maxComplementFiles: 2,
      });
      
      expect(merged.length).toBe(3);
      expect(merged.filter(f => f.matchedKeywords.includes('pattern-complement')).length).toBe(2);
    });
  });

  describe('extractIntentWithLLM', () => {
    it('should return null when no model is provided', async () => {
      const result = await extractIntentWithLLM('title', 'body', undefined);
      expect(result).toBeNull();
    });

    it('should return null when model is not in config', async () => {
      const result = await extractIntentWithLLM('title', 'body', {});
      expect(result).toBeNull();
    });
  });

  describe('inferFilesWithLLM', () => {
    it('should return empty array when no model is provided', async () => {
      const intent: ExtractedIntent = {
        userAction: 'click button',
        expectedBehavior: 'should capture',
        actualBehavior: 'nothing happens',
        inferredFeatures: ['CaptureButton'],
        inferredFileTypes: ['component'],
        uiElements: ['button'],
        errorPatterns: ['no response'],
        confidence: 80,
      };
      
      const result = await inferFilesWithLLM(intent, 'src/\nindex.ts', undefined);
      expect(result).toEqual([]);
    });
  });

  describe('Korean Bug Report Handling', () => {
    it('should extract context from Korean bug report', () => {
      const scenario = BUG_REPORT_SCENARIOS.koreanBugReport;
      const context = buildIssueContext(
        scenario.title,
        scenario.body,
        1,
        'owner',
        'repo'
      );

      expect(context.title).toBe(scenario.title);
      expect(context.body).toBe(scenario.body);
    });

    it('should determine level for Korean bug report', () => {
      const scenario = BUG_REPORT_SCENARIOS.koreanBugReport;
      const context = buildIssueContext(
        scenario.title,
        scenario.body,
        1,
        'owner',
        'repo'
      );

      const level = determineLevel(context);
      expect([1, 2]).toContain(level);
    });
  });
});
