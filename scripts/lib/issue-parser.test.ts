import { describe, it, expect } from 'vitest';
import {
  parseBugReport,
  extractSearchKeywords,
  inferCategoryFromPerformance,
  buildOptimizedContext,
  isInnerLensBugReport,
} from './issue-parser';

const SAMPLE_BUG_REPORT = `## Bug Report

아무런 값을 입력하지 않아도 정산 멤버가 추가되는 버그가 있어요

---

### Environment

| Field | Value |
|-------|-------|
| URL | http://localhost:3000/ |
| User Agent | Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) |
| Timestamp | 2026-01-06T14:26:08.789Z |

---

### Page Context

**Route:** /
**Title:** 돈줘 - 깔끔한 여행 정산
**Time on Page:** 4.1s

---

### Performance

LCP: 760ms | FID: 1ms | CLS: 0.000 | TTFB: 9ms | DOM Loaded: 680ms | Load Complete: 1332ms | Resources: 64

---

### Console Logs

\`\`\`
[INFO] [NETWORK] POST https://api.example.com/users
Status: 200
Duration: 98ms
\`\`\`

---

### User Actions (Last 20)

\`\`\`
[2026-01-06T14:26:02.948Z] CLICK on section > div.rounded-xl.shadow-brutal-sm > form.gap-2 > input.rounded-xl.px-4
[2026-01-06T14:26:03.962Z] CLICK on section > div.rounded-xl.shadow-brutal-sm > form.gap-2 > button.dark:text-black.px-4
[2026-01-06T14:26:03.963Z] SUBMIT on main.space-y-6.overflow-y-auto > section > div.rounded-xl.shadow-brutal-sm > form.gap-2
\`\`\`

---

### Navigation History

\`\`\`
[2026-01-06T14:26:01.894Z] pageload: [direct] → http://localhost:3000/
\`\`\`

---

### Session Replay

📹 Session replay data attached (61.1KB compressed)

---

### Metadata

\`\`\`json
{
  "repository": "jhlee0409/donjwo",
  "labels": [
    "inner-lens"
  ]
}
\`\`\`
`;

describe('isInnerLensBugReport', () => {
  it('should detect inner-lens bug report', () => {
    expect(isInnerLensBugReport(SAMPLE_BUG_REPORT)).toBe(true);
  });

  it('should return false for regular issue', () => {
    const regularIssue = 'This is a simple bug report without structured data.';
    expect(isInnerLensBugReport(regularIssue)).toBe(false);
  });
});

describe('parseBugReport', () => {
  it('should parse description', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.description).toContain('정산 멤버가 추가되는 버그');
  });

  it('should parse environment', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.environment.url).toBe('http://localhost:3000/');
    expect(parsed.environment.timestamp).toBe('2026-01-06T14:26:08.789Z');
  });

  it('should parse page context', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.pageContext.route).toBe('/');
    expect(parsed.pageContext.title).toBe('돈줘 - 깔끔한 여행 정산');
    expect(parsed.pageContext.timeOnPage).toBe(4.1);
  });

  it('should parse performance metrics', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.performance.lcp).toBe(760);
    expect(parsed.performance.fid).toBe(1);
    expect(parsed.performance.cls).toBe(0);
    expect(parsed.performance.ttfb).toBe(9);
  });

  it('should parse user actions', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.userActions).toHaveLength(3);
    expect(parsed.userActions[0].action).toBe('CLICK');
    expect(parsed.userActions[2].action).toBe('SUBMIT');
  });

  it('should parse navigation history', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.navigationHistory).toHaveLength(1);
    expect(parsed.navigationHistory[0].type).toBe('pageload');
    expect(parsed.navigationHistory[0].to).toBe('http://localhost:3000/');
  });

  it('should parse session replay metadata', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.sessionReplay.hasData).toBe(true);
    expect(parsed.sessionReplay.sizeKB).toBe(61.1);
    expect(parsed.sessionReplay.isCompressed).toBe(true);
  });

  it('should parse metadata', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    expect(parsed.metadata.repository).toBe('jhlee0409/donjwo');
    expect(parsed.metadata.labels).toContain('inner-lens');
  });
});

describe('extractSearchKeywords', () => {
  it('should extract keywords from page context', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const keywords = extractSearchKeywords(parsed);
    expect(keywords).toContain('index');
    expect(keywords).toContain('home');
  });

  it('should filter tailwind utility classes from user actions', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const keywords = extractSearchKeywords(parsed);
    expect(keywords.some(k => k.startsWith('shadow-'))).toBe(false);
    expect(keywords.some(k => k.startsWith('px-'))).toBe(false);
  });

  it('should extract form-related keywords', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const keywords = extractSearchKeywords(parsed);
    expect(keywords).toContain('form');
  });
});

describe('inferCategoryFromPerformance', () => {
  it('should return performance for high LCP', () => {
    expect(inferCategoryFromPerformance({ lcp: 3000 })).toBe('performance');
  });

  it('should return performance for high FID', () => {
    expect(inferCategoryFromPerformance({ fid: 150 })).toBe('performance');
  });

  it('should return ui_ux for high CLS', () => {
    expect(inferCategoryFromPerformance({ cls: 0.2 })).toBe('ui_ux');
  });

  it('should return null for good metrics', () => {
    expect(inferCategoryFromPerformance({ lcp: 760, fid: 1, cls: 0 })).toBe(null);
  });
});

describe('buildOptimizedContext', () => {
  it('should show session replay metadata without binary data', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const context = buildOptimizedContext(parsed);

    expect(context).toContain('Session replay available');
    expect(context).toContain('not included in analysis context');
    expect(context).not.toContain('base64');
  });

  it('should include structured performance metrics', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const context = buildOptimizedContext(parsed);

    expect(context).toContain('LCP: 760ms');
    expect(context).toContain('FID: 1ms');
  });

  it('should include user actions', () => {
    const parsed = parseBugReport(SAMPLE_BUG_REPORT);
    const context = buildOptimizedContext(parsed);

    expect(context).toContain('CLICK');
    expect(context).toContain('SUBMIT');
  });
});
