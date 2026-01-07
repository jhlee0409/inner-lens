/**
 * Sensitive Data Masking Engine
 * Security-first approach to prevent PII leakage in bug reports
 *
 * Design principle: When in doubt, mask it out.
 * False positives are acceptable; false negatives are not.
 */

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

/**
 * Check if a key name indicates sensitive data
 */
export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((regex) => regex.test(key));
}

/**
 * Collection of regex patterns to detect and mask sensitive data
 */
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
  // Generic API keys (common patterns)
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
  // Credit card numbers (Visa, Mastercard, Amex, etc.)
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
  // SSN (US Social Security Numbers)
  {
    name: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN_REDACTED]',
  },
  // Phone numbers (various formats - US)
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
  // Generic secrets in environment variable format
  {
    name: 'env_secret',
    pattern: /(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|PRIVATE[_-]?KEY)[=:\s]+["']?[^\s"']{8,}["']?/gi,
    replacement: '[SECRET_REDACTED]',
  },
  // Private keys (PEM format markers)
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
 * Masks sensitive data in the provided text
 * @param text - The text to mask
 * @returns The masked text with sensitive data redacted
 */
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

/**
 * Masks sensitive data in an object recursively
 * @param obj - The object to mask
 * @returns A new object with sensitive data masked
 */
export function maskSensitiveObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return maskSensitiveData(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => maskSensitiveObject(item)) as T;
  }

  if (typeof obj === 'object') {
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Also mask sensitive key names
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('token') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('private')
      ) {
        masked[key] = '[REDACTED]';
      } else {
        masked[key] = maskSensitiveObject(value);
      }
    }
    return masked as T;
  }

  return obj;
}

/**
 * Validates that no obvious sensitive data remains
 * Returns true if text appears safe, false if potential leaks detected
 */
export function validateMasking(text: string): boolean {
  // Check for common unmasked patterns
  const dangerPatterns = [
    /@.*\.\w{2,4}/i, // Emails
    /sk-[a-z0-9]/i, // API keys
    /eyJ[a-z0-9]/i, // JWTs
    /AKIA[A-Z0-9]/i, // AWS
    /ghp_[a-z0-9]/i, // GitHub
  ];

  for (const pattern of dangerPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  return true;
}
