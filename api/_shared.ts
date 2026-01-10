/**
 * Shared utilities for API functions
 * These are duplicated from src/ because Vercel Functions can't access src/ folder
 *
 * ⚠️ IMPORTANT: Keep in sync with:
 * - src/types.ts (HostedBugReportPayload, LogEntry, MAX_LOG_ENTRIES)
 * - src/utils/masking.ts (maskSensitiveData, MASKING_PATTERNS)
 */

import { z } from 'zod';

// ============================================
// Types
// ============================================

export type LogEntryType =
  | 'console'
  | 'runtime'
  | 'resource'
  | 'network'
  | 'promise_rejection';

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
  type?: LogEntryType;
}

// User Action Types
export type UserActionType =
  | 'click'
  | 'dblclick'
  | 'input'
  | 'change'
  | 'focus'
  | 'blur'
  | 'scroll'
  | 'keydown'
  | 'submit'
  | 'copy'
  | 'paste'
  | 'select';

export interface UserAction {
  type: UserActionType;
  target: string;
  timestamp: number;
  value?: string;
  position?: { x: number; y: number };
  key?: string;
  metadata?: Record<string, unknown>;
}

// Navigation Types
export type NavigationType =
  | 'pageload'
  | 'pushstate'
  | 'replacestate'
  | 'popstate'
  | 'hashchange'
  | 'beforeunload';

export interface NavigationEntry {
  type: NavigationType;
  timestamp: number;
  from: string;
  to: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// Performance Types
export interface CoreWebVitals {
  LCP?: number;
  FID?: number;
  CLS?: number;
  INP?: number;
  TTFB?: number;
  FCP?: number;
}

export interface PerformanceSummary {
  coreWebVitals: CoreWebVitals;
  timing: {
    domContentLoaded: number;
    loadComplete: number;
    timeToInteractive?: number;
  };
  resourceCount: number;
  memoryUsage?: number;
  score?: number;
}

export interface PageContext {
  route: string;
  pathname: string;
  hash: string;
  componentStack?: string;
  title: string;
  timeOnPage: number;
  referrer?: string;
}

export interface Reporter {
  name: string;
  email?: string;
  id?: string;
}

export interface HostedBugReportPayload {
  owner: string;
  repo: string;
  description: string;
  logs?: LogEntry[];
  url?: string;
  userAgent?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  branch?: string;
  // Extended context
  userActions?: UserAction[];
  navigations?: NavigationEntry[];
  performance?: PerformanceSummary;
  sessionReplay?: string;
  pageContext?: PageContext;
  reporter?: Reporter;
}

// ============================================
// Constants
// ============================================

export const MAX_LOG_ENTRIES = 50;
export const MAX_SESSION_REPLAY_SIZE = 5 * 1024 * 1024;
export const MAX_PAYLOAD_SIZE = 10 * 1024 * 1024;

// ============================================
// Masking
// ============================================

interface MaskingPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Patterns to detect sensitive KEY NAMES in objects
 * Based on: watson/is-secret, Sentry defaults, Lumigo, Elastic APM
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  // Authentication & Passwords
  /passw(or)?d/i,
  /^pw$/i,
  /^pass$/i,
  /passwd/i,
  /credential/i,
  /auth/i,

  // Tokens & Keys
  /secret/i,
  /token/i,
  /api[-._]?key/i,
  /[-._]key$/i, // ends with key: secret_key, apiKey
  /^key[-._]/i, // starts with key: key_secret
  /bearer/i,
  /private[-._]?key/i,
  /public[-._]?key/i,

  // Session & Access
  /session[-._]?id/i,
  /access[-._]?token/i,
  /refresh[-._]?token/i,
  /auth[-._]?token/i,
  /id[-._]?token/i,

  // Certificates & Crypto
  /cert(ificate)?/i,
  /ssl/i,
  /encryption/i,
  /signing/i,
  /nonce/i,
  /salt/i,
  /hash/i,

  // Database & Connection
  /mysql[-._]?pwd/i,
  /connection[-._]?string/i,
  /database[-._]?url/i,
  /db[-._]?pass/i,

  // Cloud & Services
  /aws[-._]?(secret|key|token)/i,
  /azure[-._]?(key|secret|token)/i,
  /gcp[-._]?(key|secret|token)/i,
  /firebase[-._]?/i,

  // Webhook & Integration
  /webhook/i,
  /callback[-._]?url/i,
  /client[-._]?secret/i,
  /client[-._]?id/i,
  /app[-._]?secret/i,

  // Personal & Sensitive
  /ssn/i,
  /social[-._]?security/i,
  /tax[-._]?id/i,
  /license[-._]?number/i,
  /passport/i,
  /credit[-._]?card/i,
  /cvv/i,
  /pin/i,

  // Generic catch-all for safety
  /[-._]secret[-._]?/i,
  /[-._]private[-._]?/i,
  /[-._]secure[-._]?/i,
];

export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((regex) => regex.test(key));
}

const MASKING_PATTERNS: MaskingPattern[] = [
  // URL-based patterns must come FIRST to avoid partial matches by phone/SSN patterns
  // Discord webhook URLs
  {
    name: 'discord_webhook',
    pattern: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+/gi,
    replacement: '[DISCORD_WEBHOOK_REDACTED]',
  },
  // Database connection strings
  {
    name: 'database_url',
    pattern: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    replacement: '[DATABASE_URL_REDACTED]',
  },
  // Email addresses
  {
    name: 'email',
    pattern: /\b[\w.-]+@[\w.-]+\.\w{2,4}\b/gi,
    replacement: '[EMAIL_REDACTED]',
  },
  // Bearer tokens
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    replacement: 'Bearer [TOKEN_REDACTED]',
  },
  // Generic API keys
  {
    name: 'api_key_param',
    pattern: /(?:api[_-]?key|apikey|api[_-]?token)[=:]["']?[a-zA-Z0-9\-._~+/]{16,}["']?/gi,
    replacement: 'api_key=[API_KEY_REDACTED]',
  },
  // Authorization headers
  {
    name: 'auth_header',
    pattern: /(?:Authorization|X-API-Key|X-Auth-Token)[:\s]+["']?[a-zA-Z0-9\-._~+/]{8,}["']?/gi,
    replacement: 'Authorization: [AUTH_REDACTED]',
  },
  // Credit card numbers
  {
    name: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    replacement: '[CARD_REDACTED]',
  },
  // Credit card with spaces/dashes
  {
    name: 'credit_card_formatted',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD_REDACTED]',
  },
  // SSN
  {
    name: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
  },
  // Phone numbers (US)
  {
    name: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  // IPv4 addresses
  {
    name: 'ipv4',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_REDACTED]',
  },
  // IPv6 addresses (full and compressed forms)
  {
    name: 'ipv6',
    pattern: /(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:)+:(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4}|::1/g,
    replacement: '[IP_REDACTED]',
  },
  // AWS Access Keys
  {
    name: 'aws_key',
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
    replacement: '[AWS_KEY_REDACTED]',
  },
  // AWS Secret Keys
  {
    name: 'aws_secret',
    pattern: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[=:\s]+["']?[a-zA-Z0-9/+=]{40}["']?/gi,
    replacement: 'aws_secret_access_key=[AWS_SECRET_REDACTED]',
  },
  // GitHub tokens
  {
    name: 'github_token',
    pattern: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
  },
  // OpenAI API keys
  {
    name: 'openai_key',
    pattern: /sk-[a-zA-Z0-9]{20,}/g,
    replacement: '[OPENAI_KEY_REDACTED]',
  },
  // Anthropic API keys
  {
    name: 'anthropic_key',
    pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/g,
    replacement: '[ANTHROPIC_KEY_REDACTED]',
  },
  // Google API keys
  {
    name: 'google_key',
    pattern: /AIza[a-zA-Z0-9\-_]{35}/g,
    replacement: '[GOOGLE_KEY_REDACTED]',
  },
  // Stripe keys
  {
    name: 'stripe_key',
    pattern: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
    replacement: '[STRIPE_KEY_REDACTED]',
  },
  // JWT tokens
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_.+/=]*/g,
    replacement: '[JWT_REDACTED]',
  },
  // Generic secrets
  {
    name: 'env_secret',
    pattern: /(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|PRIVATE[_-]?KEY)[=:\s]+["']?[^\s"']{8,}["']?/gi,
    replacement: '[SECRET_REDACTED]',
  },
  // Private keys (PEM format)
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
  },
  // Slack tokens (bot, user, app, session)
  {
    name: 'slack_token',
    pattern: /xox[bpas]-[\w-]{10,}/g,
    replacement: '[SLACK_TOKEN_REDACTED]',
  },
  // NPM tokens
  {
    name: 'npm_token',
    pattern: /npm_[a-zA-Z0-9]{36,}/g,
    replacement: '[NPM_TOKEN_REDACTED]',
  },
  // SendGrid API keys
  {
    name: 'sendgrid_key',
    pattern: /SG\.[\w-]{22,}\.[\w-]{22,}/g,
    replacement: '[SENDGRID_KEY_REDACTED]',
  },
  // Twilio Account SID and Auth Token
  {
    name: 'twilio_sid',
    pattern: /(?:AC|SK)[a-f0-9]{32}/gi,
    replacement: '[TWILIO_REDACTED]',
  },
];

/**
 * Sensitive key patterns for string-based key-value detection
 * Used in JSON strings, ENV vars, query params
 */
const SENSITIVE_KEY_WORDS =
  'password|passwd|pwd|secret|token|key|auth|credential|bearer|private|certificate|cert|' +
  'api[-_]?key|access[-_]?token|refresh[-_]?token|session[-_]?id|client[-_]?secret|' +
  'encryption|signing|hash|salt|nonce|ssn|cvv|pin';

/**
 * Patterns for key-value pairs in strings where key contains sensitive words
 * Masks the VALUE, preserves the KEY for debugging context
 */
const KEY_VALUE_STRING_PATTERNS: MaskingPattern[] = [
  // JSON: "secret_key": "value" or "secret_key":"value" or 'secret_key': 'value'
  {
    name: 'json_sensitive_key',
    pattern: new RegExp(
      `(["']\\w*(?:${SENSITIVE_KEY_WORDS})\\w*["'])\\s*:\\s*["']([^"']{8,})["']`,
      'gi'
    ),
    replacement: '$1: "[REDACTED]"',
  },
  // ENV/Shell: SECRET_KEY=value or SECRET_KEY="value" (SCREAMING_CASE)
  {
    name: 'env_sensitive_key',
    pattern: new RegExp(
      `\\b([A-Z_]*(?:${SENSITIVE_KEY_WORDS.toUpperCase().replace(/-/g, '_')})\\w*)\\s*=\\s*["']?([^\\s"'&]{8,})["']?`,
      'gi'
    ),
    replacement: '$1=[REDACTED]',
  },
  // Query params: ?secret_key=value or &secret_key=value
  {
    name: 'query_sensitive_key',
    pattern: new RegExp(
      `([?&])([\\w]*(?:${SENSITIVE_KEY_WORDS})[\\w]*)=([^&\\s]{8,})`,
      'gi'
    ),
    replacement: '$1$2=[REDACTED]',
  },
  // Header-like: X-Secret-Key: value or Secret-Token: value
  {
    name: 'header_sensitive_key',
    pattern: new RegExp(
      `\\b([\\w-]*(?:${SENSITIVE_KEY_WORDS})[\\w-]*)\\s*:\\s*["']?([^\\s"'\\n]{8,})["']?`,
      'gi'
    ),
    replacement: '$1: [REDACTED]',
  },
];

export function maskSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let maskedText = text;

  // 1. Apply value-based patterns first (specific formats like JWT, AWS keys, etc.)
  for (const { pattern, replacement } of MASKING_PATTERNS) {
    maskedText = maskedText.replace(pattern, replacement);
  }

  // 2. Apply key-name-based patterns (catches anything with sensitive key names)
  for (const { pattern, replacement } of KEY_VALUE_STRING_PATTERNS) {
    maskedText = maskedText.replace(pattern, replacement);
  }

  return maskedText;
}

// ============================================
// Zod Schemas for Validation
// ============================================

const UserActionSchema = z.object({
  type: z.enum([
    'click', 'dblclick', 'input', 'change', 'focus',
    'blur', 'scroll', 'keydown', 'submit', 'copy', 'paste', 'select',
  ]),
  target: z.string(),
  timestamp: z.number(),
  value: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  key: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const NavigationEntrySchema = z.object({
  type: z.enum(['pageload', 'pushstate', 'replacestate', 'popstate', 'hashchange', 'beforeunload']),
  timestamp: z.number(),
  from: z.string(),
  to: z.string(),
  duration: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const PerformanceSummarySchema = z.object({
  coreWebVitals: z.object({
    LCP: z.number().optional(),
    FID: z.number().optional(),
    CLS: z.number().optional(),
    INP: z.number().optional(),
    TTFB: z.number().optional(),
    FCP: z.number().optional(),
  }),
  timing: z.object({
    domContentLoaded: z.number(),
    loadComplete: z.number(),
    timeToInteractive: z.number().optional(),
  }),
  resourceCount: z.number(),
  memoryUsage: z.number().optional(),
  score: z.number().optional(),
});

const PageContextSchema = z.object({
  route: z.string(),
  pathname: z.string(),
  hash: z.string(),
  componentStack: z.string().optional(),
  title: z.string(),
  timeOnPage: z.number(),
  referrer: z.string().optional(),
});

const LogEntrySchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'log']),
  message: z.string(),
  timestamp: z.number(),
  stack: z.string().optional(),
  type: z.enum(['console', 'runtime', 'resource', 'network', 'promise_rejection']).optional(),
});

const ReporterSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  id: z.string().optional(),
});

export const HostedBugReportPayloadSchema = z.object({
  owner: z.string().min(1, 'Owner is required'),
  repo: z.string().min(1, 'Repo is required'),
  description: z.string().min(1, 'Description is required').max(10000, 'Description too long'),
  logs: z.array(LogEntrySchema).optional(),
  url: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  branch: z.string().optional(),
  userActions: z.array(UserActionSchema).optional(),
  navigations: z.array(NavigationEntrySchema).optional(),
  performance: PerformanceSummarySchema.optional(),
  sessionReplay: z.string().optional(),
  pageContext: PageContextSchema.optional(),
  reporter: ReporterSchema.optional(),
});

export type ValidatedHostedBugReport = z.infer<typeof HostedBugReportPayloadSchema>;

export function validateHostedBugReport(
  payload: unknown
): { success: true; data: ValidatedHostedBugReport } | { success: false; error: string } {
  const result = HostedBugReportPayloadSchema.safeParse(payload);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');

  return { success: false, error: errorMessages };
}

// ============================================
// Issue Formatting
// ============================================

export function formatIssueBody(payload: HostedBugReportPayload): string {
  const maskedDescription = maskSensitiveData(payload.description);
  const maskedLogs = payload.logs
    ?.map((log) => ({
      ...log,
      message: maskSensitiveData(log.message),
      stack: log.stack ? maskSensitiveData(log.stack) : undefined,
    }))
    .slice(-MAX_LOG_ENTRIES) || [];

  const formattedUserActions = payload.userActions?.length
    ? payload.userActions.slice(-20).map((action) => {
        const time = new Date(action.timestamp).toISOString();
        const value = action.value ? ` → "${maskSensitiveData(action.value.slice(0, 50))}"` : '';
        return `[${time}] ${action.type.toUpperCase()} on ${action.target}${value}`;
      }).join('\n')
    : null;

  const formattedNavigations = payload.navigations?.length
    ? payload.navigations.slice(-10).map((nav) => {
        const time = new Date(nav.timestamp).toISOString();
        const duration = nav.duration ? ` (${nav.duration}ms)` : '';
        return `[${time}] ${nav.type}: ${maskSensitiveData(nav.from)} → ${maskSensitiveData(nav.to)}${duration}`;
      }).join('\n')
    : null;

  const formattedPerformance = payload.performance
    ? [
        `LCP: ${payload.performance.coreWebVitals.LCP?.toFixed(0) ?? 'N/A'}ms`,
        `FID: ${payload.performance.coreWebVitals.FID?.toFixed(0) ?? 'N/A'}ms`,
        `CLS: ${payload.performance.coreWebVitals.CLS?.toFixed(3) ?? 'N/A'}`,
        `TTFB: ${payload.performance.coreWebVitals.TTFB?.toFixed(0) ?? 'N/A'}ms`,
        `DOM Loaded: ${payload.performance.timing.domContentLoaded}ms`,
        `Load Complete: ${payload.performance.timing.loadComplete}ms`,
        `Resources: ${payload.performance.resourceCount}`,
      ].join(' | ')
    : null;

  const formattedPageContext = payload.pageContext
    ? [
        `**Route:** ${maskSensitiveData(payload.pageContext.pathname)}`,
        `**Title:** ${payload.pageContext.title}`,
        `**Time on Page:** ${(payload.pageContext.timeOnPage / 1000).toFixed(1)}s`,
        payload.pageContext.componentStack ? `**Component:** ${payload.pageContext.componentStack}` : null,
      ].filter(Boolean).join('\n')
    : null;

  const formattedReporter = payload.reporter
    ? [
        `**Name:** ${payload.reporter.name}`,
        payload.reporter.email ? `**Email:** ${maskSensitiveData(payload.reporter.email)}` : null,
        payload.reporter.id ? `**ID:** ${payload.reporter.id}` : null,
      ].filter(Boolean).join(' | ')
    : null;

  let body = `## Bug Report\n\n${maskedDescription}\n`;

  if (payload.branch) {
    body += `\n---\n\n### Branch\n\n**${payload.branch}**\n`;
  }

  if (formattedReporter) {
    body += `\n---\n\n### Reporter\n\n${formattedReporter}\n`;
  }

  const branchRow = payload.branch
    ? `| Branch | ${payload.branch} |\n`
    : '';

  body += `\n---\n\n### Environment\n\n| Field | Value |\n|-------|-------|\n| URL | ${maskSensitiveData(payload.url || 'N/A')} |\n| User Agent | ${payload.userAgent || 'N/A'} |\n| Timestamp | ${payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString()} |\n${branchRow}`;

  if (formattedPageContext) {
    body += `\n---\n\n### Page Context\n\n${formattedPageContext}\n`;
  }

  if (formattedPerformance) {
    body += `\n---\n\n### Performance\n\n${formattedPerformance}\n`;
  }

  if (maskedLogs.length > 0) {
    body += `\n---\n\n<details>\n<summary><b>Console Logs (${maskedLogs.length} entries)</b></summary>\n\n\`\`\`\n${maskedLogs.map((log) => `[${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`).join('\n')}\n\`\`\`\n\n</details>\n`;
  }

  if (formattedUserActions) {
    body += `\n---\n\n<details>\n<summary><b>User Actions (${payload.userActions?.length ?? 0} events)</b></summary>\n\n\`\`\`\n${formattedUserActions}\n\`\`\`\n\n</details>\n`;
  }

  if (formattedNavigations) {
    body += `\n---\n\n<details>\n<summary><b>Navigation History (${payload.navigations?.length ?? 0} entries)</b></summary>\n\n\`\`\`\n${formattedNavigations}\n\`\`\`\n\n</details>\n`;
  }

  if (payload.sessionReplay) {
    body += `\n---\n\n### Session Replay\n\n📹 Session replay data attached (${(payload.sessionReplay.length / 1024).toFixed(1)}KB compressed)\n`;
  }

  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    body += `\n---\n\n### Metadata\n\n\`\`\`json\n${maskSensitiveData(JSON.stringify(payload.metadata, null, 2))}\n\`\`\`\n`;
  }

  body += `\n---\n\n<sub>Reported via [inner-lens](https://github.com/jhlee0409/inner-lens)</sub>\n`;

  return body;
}
