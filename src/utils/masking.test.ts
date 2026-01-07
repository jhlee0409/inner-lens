import { describe, it, expect } from 'vitest';
import { maskSensitiveData, maskSensitiveObject, validateMasking, isSensitiveKey } from './masking';

describe('maskSensitiveData', () => {
  it('masks email addresses', () => {
    expect(maskSensitiveData('Contact john@example.com')).toBe(
      'Contact [EMAIL_REDACTED]'
    );
  });

  it('masks Bearer tokens', () => {
    expect(maskSensitiveData('Bearer abc123xyz')).toBe('Bearer [TOKEN_REDACTED]');
  });

  it('masks OpenAI API keys regardless of context', () => {
    const result = maskSensitiveData('key: sk-1234567890abcdefghij');
    expect(result).not.toContain('sk-');
    expect(result).toContain('[REDACTED]');
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

describe('isSensitiveKey', () => {
  it('detects password variations', () => {
    expect(isSensitiveKey('password')).toBe(true);
    expect(isSensitiveKey('Password')).toBe(true);
    expect(isSensitiveKey('passwd')).toBe(true);
    expect(isSensitiveKey('user_password')).toBe(true);
    expect(isSensitiveKey('pw')).toBe(true);
  });

  it('detects secret variations', () => {
    expect(isSensitiveKey('secret')).toBe(true);
    expect(isSensitiveKey('client_secret')).toBe(true);
    expect(isSensitiveKey('app_secret')).toBe(true);
    expect(isSensitiveKey('SECRET_KEY')).toBe(true);
  });

  it('detects token variations', () => {
    expect(isSensitiveKey('token')).toBe(true);
    expect(isSensitiveKey('access_token')).toBe(true);
    expect(isSensitiveKey('refresh_token')).toBe(true);
    expect(isSensitiveKey('auth_token')).toBe(true);
    expect(isSensitiveKey('bearer')).toBe(true);
  });

  it('detects key variations', () => {
    expect(isSensitiveKey('api_key')).toBe(true);
    expect(isSensitiveKey('apiKey')).toBe(true);
    expect(isSensitiveKey('secret_key')).toBe(true);
    expect(isSensitiveKey('private_key')).toBe(true);
    expect(isSensitiveKey('public_key')).toBe(true);
  });

  it('detects auth and credential', () => {
    expect(isSensitiveKey('auth')).toBe(true);
    expect(isSensitiveKey('credential')).toBe(true);
    expect(isSensitiveKey('credentials')).toBe(true);
  });

  it('detects cloud service patterns', () => {
    expect(isSensitiveKey('aws_secret')).toBe(true);
    expect(isSensitiveKey('aws_key')).toBe(true);
    expect(isSensitiveKey('azure_key')).toBe(true);
    expect(isSensitiveKey('gcp_token')).toBe(true);
  });

  it('detects certificate and crypto', () => {
    expect(isSensitiveKey('cert')).toBe(true);
    expect(isSensitiveKey('certificate')).toBe(true);
    expect(isSensitiveKey('ssl')).toBe(true);
    expect(isSensitiveKey('encryption')).toBe(true);
    expect(isSensitiveKey('hash')).toBe(true);
    expect(isSensitiveKey('salt')).toBe(true);
    expect(isSensitiveKey('nonce')).toBe(true);
  });

  it('detects PII patterns', () => {
    expect(isSensitiveKey('ssn')).toBe(true);
    expect(isSensitiveKey('social_security')).toBe(true);
    expect(isSensitiveKey('cvv')).toBe(true);
    expect(isSensitiveKey('pin')).toBe(true);
    expect(isSensitiveKey('passport')).toBe(true);
    expect(isSensitiveKey('credit_card')).toBe(true);
  });

  it('returns false for safe keys', () => {
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('email')).toBe(false);
    expect(isSensitiveKey('user_id')).toBe(false);
    expect(isSensitiveKey('created_at')).toBe(false);
    expect(isSensitiveKey('status')).toBe(false);
  });

  it('handles edge cases', () => {
    expect(isSensitiveKey('')).toBe(false);
    expect(isSensitiveKey(null as unknown as string)).toBe(false);
    expect(isSensitiveKey(undefined as unknown as string)).toBe(false);
  });
});

describe('maskSensitiveData - key-value patterns in strings', () => {
  describe('JSON key-value patterns', () => {
    it('masks JSON with sensitive key names', () => {
      const json = '{"secret_key": "mysupersecretvalue123"}';
      expect(maskSensitiveData(json)).toBe('{"secret_key": "[REDACTED]"}');
    });

    it('masks JSON password field', () => {
      const json = '{"password": "secretpass123"}';
      expect(maskSensitiveData(json)).toBe('{"password": "[REDACTED]"}');
    });

    it('masks JSON token field', () => {
      const json = '{"access_token": "eyJabcdefghij123456"}';
      expect(maskSensitiveData(json)).toBe('{"access_token": "[REDACTED]"}');
    });

    it('preserves short values (under 8 chars)', () => {
      const json = '{"token": "short"}';
      expect(maskSensitiveData(json)).toBe('{"token": "short"}');
    });
  });

  describe('ENV variable patterns', () => {
    it('masks ENV style secret', () => {
      const result = maskSensitiveData('SECRET_KEY=mysupersecretvalue');
      expect(result).not.toContain('mysupersecretvalue');
      expect(result).toContain('[REDACTED]');
    });

    it('masks ENV style password', () => {
      const result = maskSensitiveData('DB_PASSWORD=databasepassword123');
      expect(result).not.toContain('databasepassword123');
      expect(result).toContain('REDACTED');
    });

    it('masks ENV style token', () => {
      const result = maskSensitiveData('AUTH_TOKEN=verylongtokenvalue');
      expect(result).not.toContain('verylongtokenvalue');
      expect(result).toContain('REDACTED');
    });
  });

  describe('Query parameter patterns', () => {
    it('masks query param with secret', () => {
      const result = maskSensitiveData('?api_key=longsecretapikey123');
      expect(result).not.toContain('longsecretapikey123');
      expect(result).toContain('[REDACTED]');
    });

    it('masks query param with token', () => {
      const result = maskSensitiveData('&access_token=longtokenvalue123');
      expect(result).not.toContain('longtokenvalue123');
      expect(result).toContain('REDACTED');
    });

    it('masks multiple sensitive params while preserving safe ones', () => {
      const url = '?api_key=secretkey123456&normal=value&token=secrettoken12';
      const result = maskSensitiveData(url);
      expect(result).not.toContain('secretkey123456');
      expect(result).not.toContain('secrettoken12');
      expect(result).toContain('normal=value');
      expect(result).toContain('[REDACTED]');
    });
  });

  describe('Header patterns', () => {
    it('masks header with sensitive name', () => {
      const result = maskSensitiveData('X-Api-Key: longsecretapikey123');
      expect(result).not.toContain('longsecretapikey123');
      expect(result).toContain('[REDACTED]');
    });

    it('masks authorization header', () => {
      const result = maskSensitiveData('X-Auth-Token: verylongtokenval');
      expect(result).not.toContain('verylongtokenval');
      expect(result).toContain('[REDACTED]');
    });
  });
});

describe('maskSensitiveObject - extended key patterns', () => {
  it('redacts keys ending with _key', () => {
    const obj = {
      secret_key: 'value123',
      api_key: 'value456',
      encryption_key: 'value789',
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.secret_key).toBe('[REDACTED]');
    expect(masked.api_key).toBe('[REDACTED]');
    expect(masked.encryption_key).toBe('[REDACTED]');
  });

  it('redacts cloud service keys', () => {
    const obj = {
      aws_secret: 'awsvalue',
      azure_key: 'azurevalue',
      gcp_token: 'gcpvalue',
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.aws_secret).toBe('[REDACTED]');
    expect(masked.azure_key).toBe('[REDACTED]');
    expect(masked.gcp_token).toBe('[REDACTED]');
  });

  it('redacts certificate and crypto fields', () => {
    const obj = {
      cert: 'certdata',
      certificate: 'certdata',
      ssl: 'ssldata',
      hash: 'hashdata',
      salt: 'saltdata',
      nonce: 'noncedata',
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.cert).toBe('[REDACTED]');
    expect(masked.certificate).toBe('[REDACTED]');
    expect(masked.ssl).toBe('[REDACTED]');
    expect(masked.hash).toBe('[REDACTED]');
    expect(masked.salt).toBe('[REDACTED]');
    expect(masked.nonce).toBe('[REDACTED]');
  });

  it('redacts PII fields', () => {
    const obj = {
      ssn: '123-45-6789',
      cvv: '123',
      pin: '1234',
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.ssn).toBe('[REDACTED]');
    expect(masked.cvv).toBe('[REDACTED]');
    expect(masked.pin).toBe('[REDACTED]');
  });

  it('handles deeply nested sensitive keys', () => {
    const obj = {
      config: {
        database: {
          connection_string: 'mysql://user:pass@host/db',
          password: 'dbpass123',
        },
        api: {
          secret_key: 'apisecret',
        },
      },
    };
    const masked = maskSensitiveObject(obj);
    expect(masked.config.database.connection_string).toBe('[REDACTED]');
    expect(masked.config.database.password).toBe('[REDACTED]');
    expect(masked.config.api.secret_key).toBe('[REDACTED]');
  });
});
