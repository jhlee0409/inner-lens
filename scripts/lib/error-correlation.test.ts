import { describe, it, expect } from 'vitest';
import {
  parseTimestamp,
  extractErrorTimestamp,
  findPrecedingActions,
  identifyTriggerAction,
  buildBreadcrumbs,
  evaluatePerformance,
  correlateErrors,
  calculateUserJourney,
  analyzeCorrelation,
  PERFORMANCE_THRESHOLDS,
} from './error-correlation';
import type { ParsedBugReport, ParsedUserAction, ParsedConsoleLog } from './issue-parser';

describe('error-correlation', () => {
  describe('parseTimestamp', () => {
    it('parses valid ISO timestamp', () => {
      const result = parseTimestamp('2024-01-06T14:30:00.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-06T14:30:00.000Z');
    });

    it('returns null for empty string', () => {
      expect(parseTimestamp('')).toBeNull();
    });

    it('returns null for invalid timestamp', () => {
      expect(parseTimestamp('not-a-date')).toBeNull();
    });
  });

  describe('extractErrorTimestamp', () => {
    it('extracts timestamp from error message', () => {
      const log: ParsedConsoleLog = {
        level: 'error',
        message: '[ERROR] [2024-01-06T14:30:00.000Z] Something went wrong',
      };
      const result = extractErrorTimestamp(log);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-06T14:30:00.000Z');
    });

    it('returns null when no timestamp in message', () => {
      const log: ParsedConsoleLog = {
        level: 'error',
        message: 'Error without timestamp',
      };
      expect(extractErrorTimestamp(log)).toBeNull();
    });
  });

  describe('findPrecedingActions', () => {
    const actions: ParsedUserAction[] = [
      { timestamp: '2024-01-06T14:29:50.000Z', action: 'CLICK', target: 'button.first' },
      { timestamp: '2024-01-06T14:29:58.000Z', action: 'INPUT', target: 'input.text' },
      { timestamp: '2024-01-06T14:29:59.500Z', action: 'CLICK', target: 'button.submit' },
      { timestamp: '2024-01-06T14:30:05.000Z', action: 'CLICK', target: 'button.after' },
    ];

    it('finds actions within default 5s window', () => {
      const errorTime = new Date('2024-01-06T14:30:00.000Z');
      const result = findPrecedingActions(actions, errorTime);
      expect(result).toHaveLength(2);
      expect(result[0].target).toBe('input.text');
      expect(result[1].target).toBe('button.submit');
    });

    it('finds actions within custom window', () => {
      const errorTime = new Date('2024-01-06T14:30:00.000Z');
      const result = findPrecedingActions(actions, errorTime, 15000);
      expect(result).toHaveLength(3);
    });

    it('returns empty array when no actions in window', () => {
      const errorTime = new Date('2024-01-06T14:25:00.000Z');
      const result = findPrecedingActions(actions, errorTime);
      expect(result).toHaveLength(0);
    });
  });

  describe('identifyTriggerAction', () => {
    it('returns undefined when no actions', () => {
      const error: ParsedConsoleLog = { level: 'error', message: 'Error' };
      const result = identifyTriggerAction([], error);
      expect(result.action).toBeUndefined();
      expect(result.confidence).toBe(0);
    });

    it('identifies CLICK on button as high confidence trigger', () => {
      const actions: ParsedUserAction[] = [
        { timestamp: '2024-01-06T14:29:59.000Z', action: 'CLICK', target: 'button.submit' },
      ];
      const error: ParsedConsoleLog = { level: 'error', message: 'Submit failed' };
      const result = identifyTriggerAction(actions, error);
      expect(result.action).toBeDefined();
      expect(result.action?.target).toBe('button.submit');
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('scores SUBMIT higher than SCROLL', () => {
      const actions: ParsedUserAction[] = [
        { timestamp: '2024-01-06T14:29:58.000Z', action: 'SCROLL', target: 'window' },
        { timestamp: '2024-01-06T14:29:59.000Z', action: 'SUBMIT', target: 'form.contact' },
      ];
      const error: ParsedConsoleLog = { level: 'error', message: 'Error' };
      const result = identifyTriggerAction(actions, error);
      expect(result.action?.action).toBe('SUBMIT');
    });
  });

  describe('buildBreadcrumbs', () => {
    it('builds breadcrumbs from report data', () => {
      const report: ParsedBugReport = {
        description: 'Test',
        environment: {},
        pageContext: {},
        performance: {},
        consoleLogs: [
          { level: 'error', message: '[2024-01-06T14:30:00.000Z] Error occurred' },
        ],
        userActions: [
          { timestamp: '2024-01-06T14:29:59.000Z', action: 'CLICK', target: 'button' },
        ],
        navigationHistory: [
          { timestamp: '2024-01-06T14:29:00.000Z', type: 'pushstate', from: '/', to: '/page' },
        ],
        sessionReplay: { hasData: false, isCompressed: false },
        metadata: {},
        rawSections: {
          description: '', environment: '', pageContext: '', performance: '',
          consoleLogs: '', userActions: '', navigationHistory: '', metadata: '',
        },
      };

      const breadcrumbs = buildBreadcrumbs(report);
      expect(breadcrumbs.length).toBeGreaterThan(0);
      expect(breadcrumbs.some(b => b.type === 'navigation')).toBe(true);
      expect(breadcrumbs.some(b => b.type === 'user')).toBe(true);
    });

    it('sorts breadcrumbs by timestamp', () => {
      const report: ParsedBugReport = {
        description: 'Test',
        environment: {},
        pageContext: {},
        performance: {},
        consoleLogs: [],
        userActions: [
          { timestamp: '2024-01-06T14:30:00.000Z', action: 'CLICK', target: 'second' },
          { timestamp: '2024-01-06T14:29:00.000Z', action: 'CLICK', target: 'first' },
        ],
        navigationHistory: [],
        sessionReplay: { hasData: false, isCompressed: false },
        metadata: {},
        rawSections: {
          description: '', environment: '', pageContext: '', performance: '',
          consoleLogs: '', userActions: '', navigationHistory: '', metadata: '',
        },
      };

      const breadcrumbs = buildBreadcrumbs(report);
      expect(breadcrumbs[0].message).toContain('first');
      expect(breadcrumbs[1].message).toContain('second');
    });
  });

  describe('evaluatePerformance', () => {
    it('evaluates LCP as good', () => {
      const result = evaluatePerformance({ lcp: 2000 });
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('good');
      expect(result[0].emoji).toBe('✅');
    });

    it('evaluates LCP as needs improvement', () => {
      const result = evaluatePerformance({ lcp: 3000 });
      expect(result[0].status).toBe('needs_improvement');
      expect(result[0].emoji).toBe('⚠️');
    });

    it('evaluates LCP as poor', () => {
      const result = evaluatePerformance({ lcp: 5000 });
      expect(result[0].status).toBe('poor');
      expect(result[0].emoji).toBe('❌');
    });

    it('evaluates multiple metrics', () => {
      const result = evaluatePerformance({
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
      });
      expect(result).toHaveLength(4);
      expect(result.every(r => r.status === 'good')).toBe(true);
    });
  });

  describe('correlateErrors', () => {
    it('correlates errors with preceding actions', () => {
      const report: ParsedBugReport = {
        description: 'Test',
        environment: {},
        pageContext: { route: '/test', timeOnPage: 30 },
        performance: {},
        consoleLogs: [
          { level: 'error', message: '[2024-01-06T14:30:00.000Z] Error occurred' },
        ],
        userActions: [
          { timestamp: '2024-01-06T14:29:58.000Z', action: 'CLICK', target: 'button.trigger' },
        ],
        navigationHistory: [
          { timestamp: '2024-01-06T14:29:00.000Z', type: 'pushstate', from: '/', to: '/test' },
        ],
        sessionReplay: { hasData: false, isCompressed: false },
        metadata: {},
        rawSections: {
          description: '', environment: '', pageContext: '', performance: '',
          consoleLogs: '', userActions: '', navigationHistory: '', metadata: '',
        },
      };

      const result = correlateErrors(report);
      expect(result).toHaveLength(1);
      expect(result[0].precedingActions).toHaveLength(1);
      expect(result[0].triggerAction?.target).toBe('button.trigger');
      expect(result[0].sessionContext.pageRoute).toBe('/test');
    });
  });

  describe('calculateUserJourney', () => {
    it('calculates journey metrics', () => {
      const report: ParsedBugReport = {
        description: 'Test',
        environment: {},
        pageContext: { timeOnPage: 60 },
        performance: {},
        consoleLogs: [
          { level: 'error', message: 'Error 1' },
        ],
        userActions: [
          { timestamp: '2024-01-06T14:29:00.000Z', action: 'CLICK', target: 'a' },
          { timestamp: '2024-01-06T14:29:30.000Z', action: 'CLICK', target: 'b' },
          { timestamp: '2024-01-06T14:30:00.000Z', action: 'CLICK', target: 'a' },
        ],
        navigationHistory: [
          { timestamp: '2024-01-06T14:29:00.000Z', type: 'pushstate', from: '/', to: '/page' },
        ],
        sessionReplay: { hasData: false, isCompressed: false },
        metadata: {},
        rawSections: {
          description: '', environment: '', pageContext: '', performance: '',
          consoleLogs: '', userActions: '', navigationHistory: '', metadata: '',
        },
      };

      const result = calculateUserJourney(report);
      expect(result.totalActions).toBe(3);
      expect(result.uniqueTargets).toBe(2);
      expect(result.navigationCount).toBe(1);
      expect(result.sessionDuration).toBe(60);
    });
  });

  describe('analyzeCorrelation', () => {
    it('performs complete correlation analysis', () => {
      const report: ParsedBugReport = {
        description: 'Test',
        environment: {},
        pageContext: { route: '/test', timeOnPage: 30 },
        performance: { lcp: 2000, cls: 0.05 },
        consoleLogs: [
          { level: 'error', message: '[2024-01-06T14:30:00.000Z] Error' },
        ],
        userActions: [
          { timestamp: '2024-01-06T14:29:59.000Z', action: 'CLICK', target: 'button' },
        ],
        navigationHistory: [],
        sessionReplay: { hasData: false, isCompressed: false },
        metadata: {},
        rawSections: {
          description: '', environment: '', pageContext: '', performance: '',
          consoleLogs: '', userActions: '', navigationHistory: '', metadata: '',
        },
      };

      const result = analyzeCorrelation(report);
      expect(result.correlatedErrors).toHaveLength(1);
      expect(result.breadcrumbs.length).toBeGreaterThan(0);
      expect(result.performanceStatus).toHaveLength(2);
      expect(result.userJourney.totalActions).toBe(1);
    });
  });

  describe('PERFORMANCE_THRESHOLDS', () => {
    it('has correct Core Web Vitals thresholds', () => {
      expect(PERFORMANCE_THRESHOLDS.lcp.good).toBe(2500);
      expect(PERFORMANCE_THRESHOLDS.fid.good).toBe(100);
      expect(PERFORMANCE_THRESHOLDS.cls.good).toBe(0.1);
      expect(PERFORMANCE_THRESHOLDS.ttfb.good).toBe(800);
    });
  });
});
