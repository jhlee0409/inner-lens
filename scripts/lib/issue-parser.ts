/**
 * Issue Parser Module
 *
 * Parses structured bug report markdown into typed objects.
 * Extracts data from inner-lens bug reports for enhanced analysis.
 */

// ============================================
// Type Definitions
// ============================================

export interface ParsedEnvironment {
  url?: string;
  userAgent?: string;
  timestamp?: string;
}

export interface ParsedPageContext {
  route?: string;
  title?: string;
  timeOnPage?: number; // in seconds
}

export interface ParsedPerformance {
  lcp?: number;  // ms
  fid?: number;  // ms
  cls?: number;
  ttfb?: number; // ms
  domLoaded?: number; // ms
  loadComplete?: number; // ms
  resources?: number;
}

export interface ParsedUserAction {
  timestamp: string;
  action: string; // CLICK, INPUT, SUBMIT, etc.
  target: string; // CSS selector path
}

export interface ParsedNavigation {
  timestamp: string;
  type: string; // pageload, pushstate, etc.
  from: string;
  to: string;
}

export interface ParsedConsoleLog {
  level: string;
  type?: string; // NETWORK, ERROR, etc.
  message: string;
  url?: string;
  status?: number;
  duration?: number;
}

export interface ParsedMetadata {
  repository?: string;
  labels?: string[];
  [key: string]: unknown;
}

export interface ParsedSessionReplay {
  hasData: boolean;
  sizeKB?: number;
  isCompressed: boolean;
}

/**
 * Complete parsed bug report structure
 */
export interface ParsedBugReport {
  description: string;
  environment: ParsedEnvironment;
  pageContext: ParsedPageContext;
  performance: ParsedPerformance;
  consoleLogs: ParsedConsoleLog[];
  userActions: ParsedUserAction[];
  navigationHistory: ParsedNavigation[];
  sessionReplay: ParsedSessionReplay;
  metadata: ParsedMetadata;
  // Raw sections for LLM context (with session replay data removed)
  rawSections: {
    description: string;
    environment: string;
    pageContext: string;
    performance: string;
    consoleLogs: string;
    userActions: string;
    navigationHistory: string;
    metadata: string;
  };
}

// ============================================
// Section Extraction
// ============================================

/**
 * Extract a section from markdown by header
 * Supports ## and ### headers
 */
function extractSection(body: string, sectionName: string): string {
  const escapedName = escapeRegex(sectionName);
  const patterns = [
    new RegExp(`###\\s*${escapedName}[^\\n]*\\n([\\s\\S]*?)(?=\\n---\\s*\\n|\\n#{2,3}\\s|$)`, 'i'),
    new RegExp(`##\\s*${escapedName}[^\\n]*\\n([\\s\\S]*?)(?=\\n---\\s*\\n|\\n#{2,3}\\s|$)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return '';
}

/**
 * Extract code block content from markdown
 */
function extractCodeBlock(section: string): string {
  const match = section.match(/```(?:\w+)?\s*\r?\n([\s\S]*?)\r?\n```/);
  if (match) {
    return match[1].trim();
  }
  const altMatch = section.match(/```[\s\S]*?```/);
  if (altMatch) {
    return altMatch[0].replace(/^```\w*\s*/, '').replace(/```$/, '').trim();
  }
  return section.trim();
}

/**
 * Extract JSON from markdown code block
 */
function extractJsonBlock(section: string): Record<string, unknown> | null {
  const content = extractCodeBlock(section);
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ============================================
// Section Parsers
// ============================================

/**
 * Parse Environment section (markdown table)
 */
function parseEnvironment(section: string): ParsedEnvironment {
  const result: ParsedEnvironment = {};

  // Parse markdown table rows: | Field | Value |
  const rows = section.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/g) || [];

  for (const row of rows) {
    const match = row.match(/\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|/);
    if (!match) continue;

    const field = match[1]?.trim().toLowerCase() || '';
    const value = match[2]?.trim() || '';

    if (field.includes('url')) {
      result.url = value;
    } else if (field.includes('user agent')) {
      result.userAgent = value;
    } else if (field.includes('timestamp')) {
      result.timestamp = value;
    }
  }

  return result;
}

/**
 * Parse Page Context section (key-value pairs)
 */
function parsePageContext(section: string): ParsedPageContext {
  const result: ParsedPageContext = {};

  const routeMatch = section.match(/\*{0,2}Route\*{0,2}:\s*\*{0,2}\s*(.+)/i);
  if (routeMatch) {
    result.route = routeMatch[1].trim();
  }

  const titleMatch = section.match(/\*{0,2}Title\*{0,2}:\s*\*{0,2}\s*(.+)/i);
  if (titleMatch) {
    result.title = titleMatch[1].trim();
  }

  const timeMatch = section.match(/\*{0,2}Time on Page\*{0,2}:\s*\*{0,2}\s*([\d.]+)s?/i);
  if (timeMatch) {
    result.timeOnPage = parseFloat(timeMatch[1]);
  }

  return result;
}

/**
 * Parse Performance section (pipe-separated metrics)
 * Format: LCP: 760ms | FID: 1ms | CLS: 0.000 | ...
 */
function parsePerformance(section: string): ParsedPerformance {
  const result: ParsedPerformance = {};

  // Split by pipe and parse each metric
  const metrics = section.split('|').map(s => s.trim());

  for (const metric of metrics) {
    const match = metric.match(/(\w+):\s*([\d.]+)(ms)?/i);
    if (!match) continue;

    const name = match[1]?.toLowerCase() || '';
    const value = parseFloat(match[2] || '0');

    switch (name) {
      case 'lcp':
        result.lcp = value;
        break;
      case 'fid':
        result.fid = value;
        break;
      case 'cls':
        result.cls = value;
        break;
      case 'ttfb':
        result.ttfb = value;
        break;
      case 'dom loaded':
      case 'domloaded':
        result.domLoaded = value;
        break;
      case 'load complete':
      case 'loadcomplete':
        result.loadComplete = value;
        break;
      case 'resources':
        result.resources = value;
        break;
    }
  }

  return result;
}

/**
 * Parse Console Logs section
 * Format: [LEVEL] [TYPE] message...
 */
function parseConsoleLogs(section: string): ParsedConsoleLog[] {
  const logs: ParsedConsoleLog[] = [];
  const content = extractCodeBlock(section);
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const log: ParsedConsoleLog = { level: 'info', message: line };

    // Parse [LEVEL] pattern
    const levelMatch = line.match(/^\[(\w+)\]/i);
    if (levelMatch) {
      log.level = levelMatch[1].toLowerCase();
    }

    // Parse [TYPE] pattern (NETWORK, ERROR, etc.)
    const typeMatch = line.match(/\[(\w+)\]\s*\[(\w+)\]/i);
    if (typeMatch) {
      log.level = typeMatch[1].toLowerCase();
      log.type = typeMatch[2].toUpperCase();
    }

    // Parse NETWORK log details
    if (log.type === 'NETWORK') {
      // Extract URL
      const urlMatch = line.match(/(GET|POST|PUT|DELETE|PATCH)\s+(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        log.url = urlMatch[2];
      }

      // Extract Status
      const statusMatch = line.match(/Status:\s*(\d+)/i);
      if (statusMatch) {
        log.status = parseInt(statusMatch[1], 10);
      }

      // Extract Duration
      const durationMatch = line.match(/Duration:\s*(\d+)ms/i);
      if (durationMatch) {
        log.duration = parseInt(durationMatch[1], 10);
      }
    }

    log.message = line;
    logs.push(log);
  }

  return logs;
}

/**
 * Parse User Actions section
 * Format: [timestamp] ACTION on selector
 */
function parseUserActions(section: string): ParsedUserAction[] {
  const actions: ParsedUserAction[] = [];
  const content = extractCodeBlock(section);
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // [2026-01-06T14:26:02.948Z] CLICK on section > div.rounded-xl > form.gap-2
    const match = line.match(/\[([\d\-T:.Z]+)\]\s*(\w+)\s+on\s+(.+)/i);
    if (match) {
      actions.push({
        timestamp: match[1],
        action: match[2].toUpperCase(),
        target: match[3].trim(),
      });
    }
  }

  return actions;
}

/**
 * Parse Navigation History section
 * Format: [timestamp] type: from → to
 */
function parseNavigationHistory(section: string): ParsedNavigation[] {
  const navigations: ParsedNavigation[] = [];
  const content = extractCodeBlock(section);
  const lines = content.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const match = line.match(/\[([\d\-T:.Z]+)\]\s*(\w+):\s*(.+?)\s*(?:→|->)\s*(.+)/i);
    if (match) {
      navigations.push({
        timestamp: match[1],
        type: match[2].toLowerCase(),
        from: match[3].trim(),
        to: match[4].trim(),
      });
    }
  }

  return navigations;
}

/**
 * Parse Session Replay section (extract metadata only)
 */
function parseSessionReplay(section: string): ParsedSessionReplay {
  const result: ParsedSessionReplay = {
    hasData: false,
    isCompressed: false,
  };

  // Check for replay data indicator
  if (section.includes('Session replay data attached') || section.includes('📹')) {
    result.hasData = true;
  }

  // Extract size: (61.1KB compressed)
  const sizeMatch = section.match(/([\d.]+)\s*KB/i);
  if (sizeMatch) {
    result.sizeKB = parseFloat(sizeMatch[1]);
  }

  // Check if compressed
  if (section.toLowerCase().includes('compressed')) {
    result.isCompressed = true;
  }

  return result;
}

/**
 * Parse Metadata section (JSON)
 */
function parseMetadata(section: string): ParsedMetadata {
  const json = extractJsonBlock(section);
  if (!json) return {};

  return {
    repository: json.repository as string | undefined,
    labels: json.labels as string[] | undefined,
    ...json,
  };
}

/**
 * Extract description (first section before ---)
 */
function extractDescription(body: string): string {
  // Get content after "## Bug Report" but before first "---"
  const bugReportMatch = body.match(/##\s*Bug Report\s*\n([\s\S]*?)(?=\n---)/i);
  if (bugReportMatch) {
    return bugReportMatch[1].trim();
  }

  // Fallback: get first paragraph
  const firstPara = body.match(/^([^#\n].+?)(?=\n\n|$)/);
  return firstPara ? firstPara[1].trim() : '';
}

// ============================================
// Main Parser
// ============================================

/**
 * Parse a complete inner-lens bug report
 */
export function parseBugReport(issueBody: string): ParsedBugReport {
  // Extract raw sections
  const rawEnvironment = extractSection(issueBody, 'Environment');
  const rawPageContext = extractSection(issueBody, 'Page Context');
  const rawPerformance = extractSection(issueBody, 'Performance');
  const rawConsoleLogs = extractSection(issueBody, 'Console Logs');
  const rawUserActions = extractSection(issueBody, 'User Actions');
  const rawNavigationHistory = extractSection(issueBody, 'Navigation History');
  const rawSessionReplay = extractSection(issueBody, 'Session Replay');
  const rawMetadata = extractSection(issueBody, 'Metadata');
  const description = extractDescription(issueBody);

  // Parse each section
  const environment = parseEnvironment(rawEnvironment);
  const pageContext = parsePageContext(rawPageContext);
  const performance = parsePerformance(rawPerformance);
  const consoleLogs = parseConsoleLogs(rawConsoleLogs);
  const userActions = parseUserActions(rawUserActions);
  const navigationHistory = parseNavigationHistory(rawNavigationHistory);
  const sessionReplay = parseSessionReplay(rawSessionReplay);
  const metadata = parseMetadata(rawMetadata);

  return {
    description,
    environment,
    pageContext,
    performance,
    consoleLogs,
    userActions,
    navigationHistory,
    sessionReplay,
    metadata,
    rawSections: {
      description,
      environment: rawEnvironment,
      pageContext: rawPageContext,
      performance: rawPerformance,
      consoleLogs: rawConsoleLogs,
      userActions: rawUserActions,
      navigationHistory: rawNavigationHistory,
      metadata: rawMetadata,
    },
  };
}

// ============================================
// Search Enhancement Helpers
// ============================================

/**
 * Extract search keywords from parsed bug report
 * These can be used to enhance file discovery
 */
export function extractSearchKeywords(parsed: ParsedBugReport): string[] {
  const keywords: string[] = [];

  // From Page Context - route can help find page files
  if (parsed.pageContext.route) {
    const route = parsed.pageContext.route;
    // Extract path segments as keywords
    const segments = route.split('/').filter(s => s && s !== '');
    keywords.push(...segments);

    // Common route-to-file mappings
    if (route === '/' || route === '') {
      keywords.push('index', 'home', 'page', 'main');
    }
  }

  for (const action of parsed.userActions) {
    const classMatches = action.target.match(/\.([a-zA-Z][\w-]*)/g) || [];
    for (const cls of classMatches) {
      const className = cls.replace('.', '');
      if (!isTailwindClass(className) && className.length > 2) {
        keywords.push(className);
      }
    }

    const componentTags = ['form', 'button', 'input', 'dialog', 'modal', 'section', 'main'];
    const selectorParts = action.target.split(/\s*>\s*/);
    for (const part of selectorParts) {
      const tagMatch = part.match(/^(\w+)/);
      if (tagMatch && componentTags.includes(tagMatch[1].toLowerCase())) {
        keywords.push(tagMatch[1].toLowerCase());
      }
    }
  }

  // From Console Logs - extract error-related keywords
  for (const log of parsed.consoleLogs) {
    if (log.level === 'error' || log.type === 'ERROR') {
      // Extract identifiers from error messages
      const identifiers = log.message.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
      keywords.push(...identifiers.filter(id => id.length > 2));
    }

    // Extract API endpoint paths
    if (log.url) {
      const urlPath = new URL(log.url, 'http://localhost').pathname;
      const pathSegments = urlPath.split('/').filter(s => s && s.length > 2);
      keywords.push(...pathSegments);
    }
  }

  // From Metadata - repository might indicate project structure
  if (parsed.metadata.repository) {
    const [, repo] = parsed.metadata.repository.split('/');
    if (repo) keywords.push(repo);
  }

  // Deduplicate and return
  return [...new Set(keywords)].filter(k => k.length > 2);
}

/**
 * Check if a class name looks like a Tailwind utility class
 */
function isTailwindClass(className: string): boolean {
  const tailwindPrefixes = [
    'flex', 'grid', 'block', 'inline', 'hidden',
    'w-', 'h-', 'm-', 'p-', 'mt-', 'mb-', 'ml-', 'mr-', 'mx-', 'my-',
    'pt-', 'pb-', 'pl-', 'pr-', 'px-', 'py-',
    'text-', 'font-', 'bg-', 'border-', 'rounded-', 'shadow-',
    'hover:', 'focus:', 'active:', 'dark:', 'sm:', 'md:', 'lg:', 'xl:',
    'gap-', 'space-', 'justify-', 'items-', 'self-',
    'overflow-', 'z-', 'opacity-', 'transition-', 'duration-',
    'min-', 'max-', 'top-', 'bottom-', 'left-', 'right-',
    'absolute', 'relative', 'fixed', 'sticky',
  ];

  return tailwindPrefixes.some(prefix =>
    className.startsWith(prefix) || className === prefix.replace('-', '')
  );
}

/**
 * Determine likely bug category from performance metrics
 */
export function inferCategoryFromPerformance(perf: ParsedPerformance): string | null {
  // High LCP (>2500ms) indicates performance issue
  if (perf.lcp && perf.lcp > 2500) {
    return 'performance';
  }

  // High FID (>100ms) indicates main thread blocking
  if (perf.fid && perf.fid > 100) {
    return 'performance';
  }

  // High CLS (>0.1) indicates layout shift issues
  if (perf.cls && perf.cls > 0.1) {
    return 'ui_ux';
  }

  // High TTFB (>600ms) indicates server-side issues
  if (perf.ttfb && perf.ttfb > 600) {
    return 'performance';
  }

  return null;
}

/**
 * Build optimized context for LLM (without session replay binary data)
 */
export function buildOptimizedContext(parsed: ParsedBugReport): string {
  const sections: string[] = [];

  // Description
  if (parsed.description) {
    sections.push(`## User Description\n${parsed.description}`);
  }

  // Environment
  if (parsed.environment.url || parsed.environment.userAgent) {
    sections.push(`## Environment
- URL: ${parsed.environment.url || 'N/A'}
- User Agent: ${parsed.environment.userAgent || 'N/A'}
- Timestamp: ${parsed.environment.timestamp || 'N/A'}`);
  }

  // Page Context
  if (parsed.pageContext.route || parsed.pageContext.title) {
    sections.push(`## Page Context
- Route: ${parsed.pageContext.route || 'N/A'}
- Title: ${parsed.pageContext.title || 'N/A'}
- Time on Page: ${parsed.pageContext.timeOnPage ? `${parsed.pageContext.timeOnPage}s` : 'N/A'}`);
  }

  // Performance (structured)
  if (Object.keys(parsed.performance).length > 0) {
    const perf = parsed.performance;
    const metrics = [
      perf.lcp !== undefined ? `LCP: ${perf.lcp}ms` : null,
      perf.fid !== undefined ? `FID: ${perf.fid}ms` : null,
      perf.cls !== undefined ? `CLS: ${perf.cls}` : null,
      perf.ttfb !== undefined ? `TTFB: ${perf.ttfb}ms` : null,
      perf.domLoaded !== undefined ? `DOM Loaded: ${perf.domLoaded}ms` : null,
      perf.loadComplete !== undefined ? `Load Complete: ${perf.loadComplete}ms` : null,
    ].filter(Boolean);

    if (metrics.length > 0) {
      sections.push(`## Performance Metrics\n${metrics.join(' | ')}`);
    }
  }

  // Console Logs (keep raw for error context)
  if (parsed.rawSections.consoleLogs) {
    sections.push(`## Console Logs\n\`\`\`\n${parsed.rawSections.consoleLogs}\n\`\`\``);
  }

  // User Actions (summarized)
  if (parsed.userActions.length > 0) {
    const actionsText = parsed.userActions
      .map(a => `[${a.timestamp}] ${a.action} on ${a.target}`)
      .join('\n');
    sections.push(`## User Actions (Last ${parsed.userActions.length})\n\`\`\`\n${actionsText}\n\`\`\``);
  }

  // Navigation History
  if (parsed.navigationHistory.length > 0) {
    const navText = parsed.navigationHistory
      .map(n => `[${n.timestamp}] ${n.type}: ${n.from} → ${n.to}`)
      .join('\n');
    sections.push(`## Navigation History\n\`\`\`\n${navText}\n\`\`\``);
  }

  // Session Replay (metadata only)
  if (parsed.sessionReplay.hasData) {
    sections.push(`## Session Replay
📹 Session replay available (${parsed.sessionReplay.sizeKB}KB ${parsed.sessionReplay.isCompressed ? 'compressed' : ''})
Note: DOM recording data is available but not included in analysis context to save tokens.`);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Check if the issue body is an inner-lens bug report
 */
export function isInnerLensBugReport(body: string): boolean {
  // Check for inner-lens markers
  const markers = [
    '## Bug Report',
    'inner-lens',
    '### Environment',
    '### Console Logs',
    '### User Actions',
  ];

  let matchCount = 0;
  for (const marker of markers) {
    if (body.includes(marker)) {
      matchCount++;
    }
  }

  // Need at least 3 markers to be confident
  return matchCount >= 3;
}
