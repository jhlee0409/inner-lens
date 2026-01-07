/**
 * Shared utilities for API functions
 * These are duplicated from src/ because Vercel Functions can't access src/ folder
 *
 * ⚠️ IMPORTANT: Keep in sync with:
 * - src/types.ts (HostedBugReportPayload, LogEntry, MAX_LOG_ENTRIES)
 * - src/utils/masking.ts (maskSensitiveData, MASKING_PATTERNS)
 */

// ============================================
// Types
// ============================================

export interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
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

// ============================================
// Masking
// ============================================

interface MaskingPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const MASKING_PATTERNS: MaskingPattern[] = [
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
  // Database connection strings
  {
    name: 'database_url',
    pattern: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    replacement: '[DATABASE_URL_REDACTED]',
  },
  // Private keys (PEM format)
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
  },
];

export function maskSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let maskedText = text;

  for (const { pattern, replacement } of MASKING_PATTERNS) {
    maskedText = maskedText.replace(pattern, replacement);
  }

  return maskedText;
}
