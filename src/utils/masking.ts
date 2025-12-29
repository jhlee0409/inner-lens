/**
 * Sensitive Data Masking Engine
 * Security-first approach to prevent PII leakage in bug reports
 */

interface MaskingPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Collection of regex patterns to detect and mask sensitive data
 */
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
  // Phone numbers (various formats)
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
  // Database connection strings
  {
    name: 'database_url',
    pattern: /(?:mongodb|mysql|postgresql|postgres|redis|amqp):\/\/[^\s"']+/gi,
    replacement: '[DATABASE_URL_REDACTED]',
  },
  // Private keys (PEM format markers)
  {
    name: 'private_key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
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
