/**
 * Confidence Calibration Module
 *
 * Calibrates AI analysis confidence scores based on evidence quality.
 * Addresses over-confident results by applying penalty factors.
 */

import type { ErrorLocation } from './file-discovery';

// ============================================
// Types
// ============================================

/**
 * File role classification for architecture-aware confidence calibration
 */
export type FileRole =
  | 'component' // React/Vue components, pages
  | 'hook' // Custom hooks (useXxx)
  | 'api' // API routes, endpoints
  | 'schema' // Zod schemas, type definitions, validation
  | 'util' // Utility functions, helpers
  | 'config' // Configuration files
  | 'test' // Test files
  | 'analytics' // Analytics, tracking, telemetry (NOT business logic)
  | 'style' // CSS, styling files
  | 'unknown'; // Cannot determine

/**
 * Self-validation data from LLM analysis
 */
export interface SelfValidation {
  counterEvidence: string[];
  assumptions: string[];
  confidenceJustification: string;
  alternativeHypotheses?: string[];
}

/**
 * Minimal interface for analysis calibration
 * Compatible with RootCauseAnalysis from Zod schema
 */
export interface AnalysisForCalibration {
  confidence: number;
  category: string;
  rootCause: {
    affectedFiles: string[];
    explanation: string;
  };
  additionalContext?: string;
  codeVerification: {
    bugExistsInCode: boolean;
    evidence: string;
  };
  selfValidation?: SelfValidation;
}

/**
 * Minimal interface for analysis result
 */
export interface AnalysisResultForCalibration {
  analyses: AnalysisForCalibration[];
  [key: string]: unknown;
}

export interface ConfidenceCalibrationResult {
  originalConfidence: number;
  calibratedConfidence: number;
  penalties: string[];
  wasCalibrated: boolean;
}

// ============================================
// File Role Classification
// ============================================

/**
 * Bug category to expected file roles mapping
 * Used for confidence calibration when file role doesn't match
 */
const BUG_CATEGORY_EXPECTED_ROLES: Record<string, FileRole[]> = {
  // Validation bugs should be in forms, APIs, or schemas - NOT analytics
  logic_error: ['component', 'hook', 'api', 'schema', 'util'],
  runtime_error: ['component', 'hook', 'api', 'util'],
  // UI bugs should be in components or styles
  ui_ux: ['component', 'style', 'hook'],
  // Performance issues can be anywhere except analytics/test
  performance: ['component', 'hook', 'api', 'util', 'config'],
  // Security issues typically in auth, API, or config
  security: ['api', 'util', 'config', 'schema'],
  // Configuration issues
  configuration: ['config', 'api', 'util'],
  // Unknown can be anywhere
  unknown: ['component', 'hook', 'api', 'schema', 'util', 'config'],
};

/**
 * File path patterns for role classification
 * Order matters - first match wins
 */
const FILE_ROLE_PATTERNS: Array<{ role: FileRole; patterns: RegExp[] }> = [
  // Analytics/Tracking - IMPORTANT: These should NOT contain business logic
  {
    role: 'analytics',
    patterns: [
      /use[A-Z]?[Aa]nalytics/, // useAnalytics, useGoogleAnalytics
      /analytics/i, // any analytics folder/file
      /tracking/i, // tracking utilities
      /telemetry/i, // telemetry
      /ga4?\.ts$/i, // GA, GA4 specific
      /gtm\.ts$/i, // Google Tag Manager
      /mixpanel/i, // Mixpanel
      /amplitude/i, // Amplitude
      /segment/i, // Segment
      /posthog/i, // PostHog
    ],
  },
  // Test files
  {
    role: 'test',
    patterns: [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /__tests__\//, /\/tests?\//],
  },
  // API routes
  {
    role: 'api',
    patterns: [/\/api\//, /\/routes?\//, /route\.[jt]s$/, /controller\.[jt]s$/, /server\.[jt]s$/],
  },
  // Schema/Validation
  {
    role: 'schema',
    patterns: [
      /schema/i,
      /validation/i,
      /validator/i,
      /\/types\//,
      /\.types\.[jt]s$/,
      /\.schema\.[jt]s$/,
      /\.d\.ts$/,
    ],
  },
  // Hooks
  {
    role: 'hook',
    patterns: [/\/hooks?\//, /use[A-Z][a-zA-Z]+\.[jt]sx?$/],
  },
  // Components
  {
    role: 'component',
    patterns: [
      /\/components?\//,
      /\/pages?\//,
      /\/app\/.*\/page\.[jt]sx?$/, // Next.js app router pages
      /\/app\/.*\/layout\.[jt]sx?$/, // Next.js layouts
      /\.[jt]sx$/, // Any JSX/TSX file (last resort for components)
    ],
  },
  // Config
  {
    role: 'config',
    patterns: [/config/i, /\.config\.[jt]s$/, /\.env/, /settings/i],
  },
  // Styles
  {
    role: 'style',
    patterns: [/\.css$/, /\.scss$/, /\.sass$/, /\.less$/, /styles?\//i],
  },
  // Utils (broad catch)
  {
    role: 'util',
    patterns: [/\/utils?\//, /\/lib\//, /\/helpers?\//, /\/common\//],
  },
];

/**
 * Classify a file's role based on its path
 */
export function classifyFileRole(filePath: string): FileRole {
  const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

  for (const { role, patterns } of FILE_ROLE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedPath) || pattern.test(filePath)) {
        return role;
      }
    }
  }

  return 'unknown';
}

/**
 * Check if a file role is appropriate for a given bug category
 */
export function isRoleAppropriateForCategory(role: FileRole, category: string): boolean {
  // Analytics files should NEVER be suggested for business logic bugs
  if (role === 'analytics') {
    return false; // Analytics files don't contain business logic
  }

  // Test files are not bug sources (unless the test itself is buggy)
  if (role === 'test') {
    return false;
  }

  const expectedRoles = BUG_CATEGORY_EXPECTED_ROLES[category];
  if (!expectedRoles) {
    return true; // Unknown category, allow any role
  }

  return expectedRoles.includes(role);
}

// ============================================
// Confidence Calibration
// ============================================

/**
 * Calibrate confidence score based on evidence quality and consistency
 * Addresses the QA feedback about over-confident results
 *
 * Key calibration factors:
 * 1. No specific file identified → max 40%
 * 2. No line number match → -20%
 * 3. File role mismatch (e.g., analytics for validation bug) → -25%
 * 4. Uncertainty markers in explanation → cap at 60%
 * 5. No code verification evidence → -15%
 */
export function calibrateConfidence(
  analysis: AnalysisForCalibration,
  errorLocations: ErrorLocation[]
): ConfidenceCalibrationResult {
  const originalConfidence = analysis.confidence;
  let calibrated = originalConfidence;
  const penalties: string[] = [];

  // 1. No affected files identified
  if (!analysis.rootCause.affectedFiles || analysis.rootCause.affectedFiles.length === 0) {
    calibrated = Math.min(calibrated, 40);
    penalties.push('No specific file identified (capped at 40%)');
  }

  // 2. Check for line number precision
  const hasLineMatch = errorLocations.some(
    loc =>
      loc.line &&
      analysis.rootCause.affectedFiles.some(f => f.toLowerCase().includes(loc.file.toLowerCase()))
  );
  if (!hasLineMatch && calibrated > 70) {
    calibrated -= 20;
    penalties.push('No line number correlation with error trace (-20%)');
  }

  // 3. File role appropriateness check
  if (analysis.rootCause.affectedFiles.length > 0) {
    const primaryFile = analysis.rootCause.affectedFiles[0];
    if (primaryFile) {
      const fileRole = classifyFileRole(primaryFile);
      if (!isRoleAppropriateForCategory(fileRole, analysis.category)) {
        calibrated -= 25;
        penalties.push(
          `File role mismatch: ${fileRole} file suggested for ${analysis.category} bug (-25%)`
        );

        // Add specific warning for analytics files
        if (fileRole === 'analytics') {
          penalties.push('⚠️ Analytics/tracking files should not contain business logic');
        }
      }
    }
  }

  // 4. Uncertainty markers in explanation
  const uncertaintyMarkers = [
    'uncertain',
    'not sure',
    'unclear',
    'possibly',
    'might be',
    'could be',
    'may be',
    'perhaps',
    'speculative',
    '불확실',
    '추가 조사',
    '확인 필요',
    '가능성',
    '可能',
    '不确定',
    '也许',
  ];
  const explanationLower = (
    analysis.rootCause.explanation + (analysis.additionalContext || '')
  ).toLowerCase();

  if (uncertaintyMarkers.some(marker => explanationLower.includes(marker))) {
    calibrated = Math.min(calibrated, 60);
    penalties.push('Uncertainty markers detected in explanation (capped at 60%)');
  }

  // 5. No code verification evidence
  if (
    !analysis.codeVerification.bugExistsInCode &&
    (!analysis.codeVerification.evidence || analysis.codeVerification.evidence.length < 50)
  ) {
    calibrated -= 15;
    penalties.push('Insufficient code verification evidence (-15%)');
  }

  // 6. Self-validation based calibration (2025 enhancement)
  if (analysis.selfValidation) {
    const sv = analysis.selfValidation;

    // 6a. If LLM listed significant counter-evidence but still claims high confidence, penalize
    if (sv.counterEvidence.length >= 2 && calibrated > 75) {
      calibrated -= 15;
      penalties.push('Multiple counter-evidence items listed but confidence >75% (-15%)');
    }

    // 6b. If many assumptions but high confidence, penalize
    if (sv.assumptions.length >= 3 && calibrated > 70) {
      calibrated -= 10;
      penalties.push('Many assumptions (3+) with high confidence (-10%)');
    }

    // 6c. Check if confidence justification is generic/weak
    const weakJustifications = [
      'seems likely',
      'probably',
      'based on the description',
      'user reported',
      'appears to be',
      'looks like',
      'should be',
    ];
    const justificationLower = sv.confidenceJustification.toLowerCase();
    if (weakJustifications.some(w => justificationLower.includes(w)) &&
        !justificationLower.includes('line') &&
        !justificationLower.includes('stack trace')) {
      calibrated = Math.min(calibrated, 65);
      penalties.push('Weak confidence justification without code evidence (capped at 65%)');
    }

    // 6d. Reward well-documented alternative hypotheses (minor boost, max +5)
    if (sv.alternativeHypotheses && sv.alternativeHypotheses.length >= 2 && calibrated < 95) {
      calibrated = Math.min(calibrated + 5, 95);
      penalties.push('✅ Well-documented alternative hypotheses (+5%)');
    }
  } else {
    // No self-validation provided - cap at 70% for high confidence claims
    if (calibrated > 70) {
      calibrated = Math.min(calibrated, 70);
      penalties.push('No self-validation provided (capped at 70%)');
    }
  }

  // 7. Generic answer detection
  const genericPhrases = [
    'check the logs',
    'add error handling',
    'review the code',
    'investigate further',
    'debug the issue',
    'more information needed',
    'could be many things',
    'various reasons',
    'multiple causes',
    '로그를 확인',
    '에러 처리 추가',
    '추가 조사 필요',
  ];
  const explanationForGeneric = analysis.rootCause.explanation.toLowerCase();
  const genericCount = genericPhrases.filter(p => explanationForGeneric.includes(p)).length;
  if (genericCount >= 2 && calibrated > 50) {
    calibrated = Math.min(calibrated, 50);
    penalties.push(`Generic/vague explanation detected (${genericCount} generic phrases, capped at 50%)`);
  }

  // Ensure confidence stays in valid range
  calibrated = Math.max(0, Math.min(100, Math.round(calibrated)));

  return {
    originalConfidence,
    calibratedConfidence: calibrated,
    penalties,
    wasCalibrated: calibrated !== originalConfidence,
  };
}

/**
 * Apply confidence calibration to all analyses in a result
 */
export function calibrateAllAnalyses<T extends AnalysisResultForCalibration>(
  result: T,
  errorLocations: ErrorLocation[]
): { result: T; calibrationReports: ConfidenceCalibrationResult[] } {
  const calibrationReports: ConfidenceCalibrationResult[] = [];

  const calibratedAnalyses = result.analyses.map(analysis => {
    const calibration = calibrateConfidence(analysis, errorLocations);
    calibrationReports.push(calibration);

    // Return analysis with calibrated confidence
    return {
      ...analysis,
      confidence: calibration.calibratedConfidence,
      // Add calibration note to additionalContext if calibrated
      additionalContext: calibration.wasCalibrated
        ? `${analysis.additionalContext || ''}\n\n📊 **Confidence Calibration:** Original ${calibration.originalConfidence}% → Adjusted ${calibration.calibratedConfidence}%${calibration.penalties.length > 0 ? `\n- ${calibration.penalties.join('\n- ')}` : ''}`
        : analysis.additionalContext,
    };
  });

  return {
    result: {
      ...result,
      analyses: calibratedAnalyses,
    } as T,
    calibrationReports,
  };
}
