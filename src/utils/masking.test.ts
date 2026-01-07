import { describe, it, expect } from 'vitest';
import { maskSensitiveData, maskSensitiveObject, validateMasking } from './masking';

describe('maskSensitiveData', () => {
  it('masks email addresses', () => {
    expect(maskSensitiveData('Contact john@example.com')).toBe(
      'Contact [EMAIL_REDACTED]'
    );
  });

  it('masks Bearer tokens', () => {
    expect(maskSensitiveData('Bearer abc123xyz')).toBe('Bearer [TOKEN_REDACTED]');
  });

  it('masks OpenAI API keys', () => {
    expect(maskSensitiveData('key: sk-1234567890abcdefghij')).toBe(
      'key: [OPENAI_KEY_REDACTED]'
    );
  });

  it('masks Anthropic API keys', () => {
    // The anthropic_key pattern matches sk-ant-*
    expect(maskSensitiveData('sk-ant-api03-abcdefghij123456')).toBe(
      '[ANTHROPIC_KEY_REDACTED]'
    );
  });

  it('masks GitHub tokens', () => {
    // GitHub tokens need 36+ chars after the prefix
    expect(
      maskSensitiveData('ghp_abcdefghijklmnopqrstuvwxyz1234567890')
    ).toBe('[GITHUB_TOKEN_REDACTED]');
  });

  it('masks JWT tokens', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    expect(maskSensitiveData(jwt)).toBe('[JWT_REDACTED]');
  });

  it('masks AWS access keys', () => {
    expect(maskSensitiveData('AKIAIOSFODNN7EXAMPLE')).toBe('[AWS_KEY_REDACTED]');
  });

  it('masks database URLs', () => {
    expect(maskSensitiveData('mongodb://user:pass@localhost:27017/db')).toBe(
      '[DATABASE_URL_REDACTED]'
    );
    expect(maskSensitiveData('postgresql://user:pass@host:5432/db')).toBe(
      '[DATABASE_URL_REDACTED]'
    );
  });

  it('masks Stripe keys', () => {
    // Stripe keys need 24+ chars after prefix
    // Using obviously fake test values
    const fakeSecretKey = 'sk_test_' + 'x'.repeat(24);
    const fakePublishableKey = 'pk_test_' + 'y'.repeat(24);
    expect(maskSensitiveData(fakeSecretKey)).toBe('[STRIPE_KEY_REDACTED]');
    expect(maskSensitiveData(fakePublishableKey)).toBe('[STRIPE_KEY_REDACTED]');
  });

  it('masks multiple patterns in one string', () => {
    const input = 'User john@test.com with key sk-abcdefghij1234567890 failed';
    const result = maskSensitiveData(input);
    expect(result).toContain('[EMAIL_REDACTED]');
    expect(result).toContain('[OPENAI_KEY_REDACTED]');
    expect(result).not.toContain('john@test.com');
    expect(result).not.toContain('sk-');
  });

  it('returns original value for non-string input', () => {
    expect(maskSensitiveData(null as unknown as string)).toBeNull();
    expect(maskSensitiveData(undefined as unknown as string)).toBeUndefined();
    expect(maskSensitiveData(123 as unknown as string)).toBe(123);
  });

  it('preserves text without sensitive data', () => {
    const text = 'This is a normal log message without secrets';
    expect(maskSensitiveData(text)).toBe(text);
  });

  it('masks IPv4 addresses', () => {
    expect(maskSensitiveData('Server IP: 192.168.1.100')).toBe(
      'Server IP: [IP_REDACTED]'
    );
    expect(maskSensitiveData('Request from 10.0.0.1')).toBe(
      'Request from [IP_REDACTED]'
    );
  });

  it('masks IPv6 addresses', () => {
    expect(maskSensitiveData('Server: 2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(
      'Server: [IP_REDACTED]'
    );
    expect(maskSensitiveData('Compressed: 2001:db8:85a3::8a2e:370:7334')).toBe(
      'Compressed: [IP_REDACTED]'
    );
    expect(maskSensitiveData('Loopback: ::1')).toBe(
      'Loopback: [IP_REDACTED]'
    );
  });

  it('masks Discord webhook URLs', () => {
    expect(maskSensitiveData('https://discord.com/api/webhooks/1234567890123456789/abc-XYZ_123')).toBe(
      '[DISCORD_WEBHOOK_REDACTED]'
    );
    expect(maskSensitiveData('https://discordapp.com/api/webhooks/9876543210/token-here')).toBe(
      '[DISCORD_WEBHOOK_REDACTED]'
    );
    expect(maskSensitiveData('https://ptb.discord.com/api/webhooks/1112223334445556667/test')).toBe(
      '[DISCORD_WEBHOOK_REDACTED]'
    );
  });

  it('masks Slack tokens', () => {
    expect(maskSensitiveData('xoxb-123456789012-1234567890123-abcdefghij')).toBe(
      '[SLACK_TOKEN_REDACTED]'
    );
    expect(maskSensitiveData('xoxp-user-token-here')).toBe(
      '[SLACK_TOKEN_REDACTED]'
    );
    expect(maskSensitiveData('xoxa-app-token-12345')).toBe(
      '[SLACK_TOKEN_REDACTED]'
    );
  });

  it('masks NPM tokens', () => {
    expect(maskSensitiveData('npm_abcdefghijklmnopqrstuvwxyz1234567890')).toBe(
      '[NPM_TOKEN_REDACTED]'
    );
  });

  it('masks SendGrid API keys', () => {
    expect(maskSensitiveData('SG.abcdefghijklmnopqrstuv.wxyz1234567890abcdefgh')).toBe(
      '[SENDGRID_KEY_REDACTED]'
    );
  });

  it('masks Twilio credentials', () => {
    expect(maskSensitiveData('ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toBe(
      '[TWILIO_REDACTED]'
    );
    expect(maskSensitiveData('SKbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')).toBe(
      '[TWILIO_REDACTED]'
    );
  });
});

describe('maskSensitiveObject', () => {
  it('masks nested object values', () => {
    const obj = {
      user: 'john@example.com',
      config: {
        apiKey: 'sk-secret123',
      },
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.user).toBe('[EMAIL_REDACTED]');
    expect(masked.config.apiKey).toBe('[REDACTED]');
  });

  it('masks arrays of strings', () => {
    const arr = ['john@test.com', 'normal text'];
    const masked = maskSensitiveObject(arr);
    expect(masked[0]).toBe('[EMAIL_REDACTED]');
    expect(masked[1]).toBe('normal text');
  });

  it('redacts sensitive key names', () => {
    const obj = {
      password: 'secret123',
      token: 'abc123',
      privateKey: 'key-data',
      normalField: 'value',
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.password).toBe('[REDACTED]');
    expect(masked.token).toBe('[REDACTED]');
    expect(masked.privateKey).toBe('[REDACTED]');
    expect(masked.normalField).toBe('value');
  });

  it('handles null and undefined', () => {
    expect(maskSensitiveObject(null)).toBeNull();
    expect(maskSensitiveObject(undefined)).toBeUndefined();
  });
});

describe('validateMasking', () => {
  it('returns true for safe text', () => {
    expect(validateMasking('This is a normal log message')).toBe(true);
    expect(validateMasking('[EMAIL_REDACTED] sent a message')).toBe(true);
  });

  it('returns false for unmasked emails', () => {
    expect(validateMasking('Contact user@example.com')).toBe(false);
  });

  it('returns false for unmasked API keys', () => {
    expect(validateMasking('key: sk-abc123')).toBe(false);
  });

  it('returns false for unmasked JWTs', () => {
    expect(validateMasking('eyJhbGciOiJIUzI1NiJ9.test')).toBe(false);
  });

  it('returns false for unmasked AWS keys', () => {
    expect(validateMasking('AKIAIOSFODNN7EXAMPLE')).toBe(false);
  });

  it('returns false for unmasked GitHub tokens', () => {
    expect(validateMasking('ghp_abcdefghij')).toBe(false);
  });
});
