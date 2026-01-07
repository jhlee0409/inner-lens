/**
 * Error-Action Correlation Module
 *
 * Correlates errors with preceding user actions to identify likely triggers.
 * Inspired by Sentry breadcrumbs and LogRocket error correlation patterns.
 *
 * Key features:
 * - Finds user actions within configurable time window before error
 * - Builds Sentry-style breadcrumbs timeline
 * - Identifies most likely trigger action
 * - Calculates user journey metrics
 */

import type {
  ParsedBugReport,
  ParsedConsoleLog,
  ParsedUserAction,
  ParsedNavigation,
  ParsedPerformance,
} from './issue-parser';

// ============================================
// Type Definitions
// ============================================

/**
 * Sentry-style breadcrumb for unified timeline
 * Compatible with industry-standard error tracking
 */
export interface Breadcrumb {
  timestamp: string;
  type: 'navigation' | 'user' | 'error' | 'network' | 'console' | 'performance';
  category: string;
  message: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  data?: Record<string, unknown>;
}

/**
 * Error with correlated preceding actions
 */
export interface CorrelatedError {
  error: ParsedConsoleLog;
  errorTimestamp: Date | null;
  precedingActions: ParsedUserAction[];
  triggerAction?: ParsedUserAction;
  triggerConfidence: number; // 0-100
  sessionContext: {
    pageRoute: string;
    timeOnPage: number;
    navigationPath: string[];
    totalActionsBeforeError: number;
  };
}

/**
 * Performance threshold configuration
 * Based on Core Web Vitals standards
 */
export interface PerformanceThresholds {
  lcp: { good: number; needsImprovement: number }; // ms
  fid: { good: number; needsImprovement: number }; // ms
  cls: { good: number; needsImprovement: number };
  ttfb: { good: number; needsImprovement: number }; // ms
}

/**
 * Performance status for display
 */
export interface PerformanceStatus {
  metric: string;
  value: number;
  unit: string;
  status: 'good' | 'needs_improvement' | 'poor';
  emoji: string;
}

/**
 * Complete correlation result
 */
export interface CorrelationResult {
  correlatedErrors: CorrelatedError[];
  breadcrumbs: Breadcrumb[];
  performanceStatus: PerformanceStatus[];
  userJourney: {
    totalActions: number;
    uniqueTargets: number;
    sessionDuration: number; // seconds
    navigationCount: number;
    errorRate: number; // errors per action
  };
}

// ============================================
// Constants
// ============================================

/**
 * Default time window for correlation (5 seconds before error)
 */
const DEFAULT_CORRELATION_WINDOW_MS = 5000;

/**
 * Core Web Vitals thresholds (Google's standards)
 */
export const PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, needsImprovement: 4000 },
  fid: { good: 100, needsImprovement: 300 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  ttfb: { good: 800, needsImprovement: 1800 },
};

// ============================================
// Core Functions
// ============================================

/**
 * Parse ISO timestamp to Date object
 * Handles various timestamp formats
 */
export function parseTimestamp(timestamp: string): Date | null {
  if (!timestamp) return null;

  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch {
    return null;
  }
}

export function extractErrorTimestamp(log: ParsedConsoleLog): Date | null {
  const isoMatch = log.message.match(/\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z?)\]/);
  if (isoMatch) {
    return parseTimestamp(isoMatch[1]);
  }
  return null;
}

/**
 * Find user actions within time window before error
 */
export function findPrecedingActions(
  actions: ParsedUserAction[],
  errorTime: Date,
  windowMs: number = DEFAULT_CORRELATION_WINDOW_MS
): ParsedUserAction[] {
  const windowStart = new Date(errorTime.getTime() - windowMs);

  return actions.filter(action => {
    const actionTime = parseTimestamp(action.timestamp);
    if (!actionTime) return false;
    return actionTime >= windowStart && actionTime <= errorTime;
  });
}

/**
 * Identify the most likely trigger action using scoring heuristics:
 * - Recency score (max 40): Recent actions score higher
 * - Action type score (max 30): CLICK/SUBMIT > INPUT > SCROLL > FOCUS
 * - Target relevance score (max 30): Interactive elements score higher
 */
export function identifyTriggerAction(
  precedingActions: ParsedUserAction[],
  error: ParsedConsoleLog
): { action: ParsedUserAction | undefined; confidence: number } {
  if (precedingActions.length === 0) {
    return { action: undefined, confidence: 0 };
  }

  const sorted = [...precedingActions].sort((a, b) => {
    const timeA = parseTimestamp(a.timestamp)?.getTime() || 0;
    const timeB = parseTimestamp(b.timestamp)?.getTime() || 0;
    return timeB - timeA;
  });

  const ACTION_SCORES: Record<string, number> = {
    CLICK: 30,
    SUBMIT: 30,
    INPUT: 20,
    SCROLL: 10,
    FOCUS: 5,
  };

  const scores = sorted.map((action, index) => {
    const recencyScore = Math.max(0, 40 - index * 10);
    const actionTypeScore = ACTION_SCORES[action.action] || 10;
    const targetScore = calculateTargetScore(action.target, error.message);
    return { action, score: recencyScore + actionTypeScore + targetScore };
  });

  const best = scores.reduce((a, b) => (a.score > b.score ? a : b));
  const confidence = Math.min(100, Math.round(best.score));

  return { action: best.action, confidence };
}

function calculateTargetScore(target: string, errorMessage: string): number {
  let score = 0;
  const targetLower = target.toLowerCase();
  const errorLower = errorMessage.toLowerCase();

  if (targetLower.includes('button') || targetLower.includes('btn')) score += 15;
  if (targetLower.includes('form')) score += 15;
  if (targetLower.includes('input')) score += 10;
  if (targetLower.includes('submit')) score += 20;
  if (targetLower.includes('modal') || targetLower.includes('dialog')) score += 10;

  const targetParts = target.split(/[.#\s>]/).filter(p => p.length > 2);
  for (const part of targetParts) {
    if (errorLower.includes(part.toLowerCase())) {
      score += 15;
      break;
    }
  }

  return Math.min(30, score);
}

export function buildBreadcrumbs(report: ParsedBugReport): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = [];

  for (const nav of report.navigationHistory) {
    breadcrumbs.push({
      timestamp: nav.timestamp,
      type: 'navigation',
      category: nav.type,
      message: `${nav.from} → ${nav.to}`,
      level: 'info',
      data: { from: nav.from, to: nav.to },
    });
  }

  for (const action of report.userActions) {
    breadcrumbs.push({
      timestamp: action.timestamp,
      type: 'user',
      category: `ui.${action.action.toLowerCase()}`,
      message: `${action.action} on ${action.target}`,
      level: 'info',
      data: { target: action.target, action: action.action },
    });
  }

  for (const log of report.consoleLogs) {
    const timestamp = extractErrorTimestamp(log);
    if (!timestamp) continue;

    const level = mapLogLevel(log.level);
    const type = log.type === 'NETWORK' ? 'network' : (level === 'error' || level === 'fatal' ? 'error' : 'console');

    breadcrumbs.push({
      timestamp: timestamp.toISOString(),
      type,
      category: log.type || log.level,
      message: log.message,
      level,
      data: log.url
        ? { url: log.url, status: log.status, duration: log.duration }
        : undefined,
    });
  }

  return breadcrumbs.sort((a, b) => {
    const timeA = parseTimestamp(a.timestamp)?.getTime() || 0;
    const timeB = parseTimestamp(b.timestamp)?.getTime() || 0;
    return timeA - timeB;
  });
}

function mapLogLevel(level: string): Breadcrumb['level'] {
  const mapping: Record<string, Breadcrumb['level']> = {
    error: 'error',
    warn: 'warning',
    warning: 'warning',
    info: 'info',
    log: 'info',
    debug: 'debug',
  };
  return mapping[level.toLowerCase()] || 'info';
}

export function evaluatePerformance(perf: ParsedPerformance): PerformanceStatus[] {
  const results: PerformanceStatus[] = [];

  if (perf.lcp !== undefined) {
    results.push(evaluateMetric('LCP', perf.lcp, 'ms', PERFORMANCE_THRESHOLDS.lcp));
  }

  if (perf.fid !== undefined) {
    results.push(evaluateMetric('FID', perf.fid, 'ms', PERFORMANCE_THRESHOLDS.fid));
  }

  if (perf.cls !== undefined) {
    results.push(evaluateMetric('CLS', perf.cls, '', PERFORMANCE_THRESHOLDS.cls));
  }

  if (perf.ttfb !== undefined) {
    results.push(evaluateMetric('TTFB', perf.ttfb, 'ms', PERFORMANCE_THRESHOLDS.ttfb));
  }

  return results;
}

function evaluateMetric(
  metric: string,
  value: number,
  unit: string,
  threshold: { good: number; needsImprovement: number }
): PerformanceStatus {
  let status: PerformanceStatus['status'];
  let emoji: string;

  if (value <= threshold.good) {
    status = 'good';
    emoji = '✅';
  } else if (value <= threshold.needsImprovement) {
    status = 'needs_improvement';
    emoji = '⚠️';
  } else {
    status = 'poor';
    emoji = '❌';
  }

  return { metric, value, unit, status, emoji };
}

export function correlateErrors(
  report: ParsedBugReport,
  windowMs: number = DEFAULT_CORRELATION_WINDOW_MS
): CorrelatedError[] {
  const correlatedErrors: CorrelatedError[] = [];

  const errorLogs = report.consoleLogs.filter(
    log => log.level === 'error' || log.type === 'ERROR'
  );

  for (const error of errorLogs) {
    const errorTimestamp = extractErrorTimestamp(error);

    let precedingActions: ParsedUserAction[] = [];
    let triggerAction: ParsedUserAction | undefined;
    let triggerConfidence = 0;

    if (errorTimestamp) {
      precedingActions = findPrecedingActions(
        report.userActions,
        errorTimestamp,
        windowMs
      );

      const triggerResult = identifyTriggerAction(precedingActions, error);
      triggerAction = triggerResult.action;
      triggerConfidence = triggerResult.confidence;
    }

    const navigationPath = report.navigationHistory.map(nav => nav.to);

    correlatedErrors.push({
      error,
      errorTimestamp,
      precedingActions,
      triggerAction,
      triggerConfidence,
      sessionContext: {
        pageRoute: report.pageContext.route || 'unknown',
        timeOnPage: report.pageContext.timeOnPage || 0,
        navigationPath,
        totalActionsBeforeError: precedingActions.length,
      },
    });
  }

  return correlatedErrors;
}

export function calculateUserJourney(report: ParsedBugReport): CorrelationResult['userJourney'] {
  const actions = report.userActions;
  const errorCount = report.consoleLogs.filter(
    log => log.level === 'error' || log.type === 'ERROR'
  ).length;

  const uniqueTargets = new Set(actions.map(a => a.target)).size;

  let sessionDuration = 0;
  if (actions.length >= 2) {
    const firstTime = parseTimestamp(actions[0].timestamp);
    const lastTime = parseTimestamp(actions[actions.length - 1].timestamp);
    if (firstTime && lastTime) {
      sessionDuration = Math.round((lastTime.getTime() - firstTime.getTime()) / 1000);
    }
  }

  if (report.pageContext.timeOnPage && report.pageContext.timeOnPage > sessionDuration) {
    sessionDuration = report.pageContext.timeOnPage;
  }

  return {
    totalActions: actions.length,
    uniqueTargets,
    sessionDuration,
    navigationCount: report.navigationHistory.length,
    errorRate: actions.length > 0 ? errorCount / actions.length : 0,
  };
}

export function analyzeCorrelation(
  report: ParsedBugReport,
  windowMs: number = DEFAULT_CORRELATION_WINDOW_MS
): CorrelationResult {
  return {
    correlatedErrors: correlateErrors(report, windowMs),
    breadcrumbs: buildBreadcrumbs(report),
    performanceStatus: evaluatePerformance(report.performance),
    userJourney: calculateUserJourney(report),
  };
}
