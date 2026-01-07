import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateBugReport,
  BugReportSchema,
  handleBugReport,
  createExpressHandler,
  createFastifyHandler,
  createKoaHandler,
  createFetchHandler,
  createNodeHandler,
} from './server';

describe('validateBugReport', () => {
  const validPayload = {
    description: 'Button click throws error',
    logs: [
      {
        level: 'error' as const,
        message: 'TypeError: Cannot read property of undefined',
        timestamp: Date.now(),
        stack: 'Error at line 42',
      },
    ],
    url: 'https://example.com/page',
    userAgent: 'Mozilla/5.0',
    timestamp: Date.now(),
  };

  it('validates a correct payload', () => {
    const result = validateBugReport(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe(validPayload.description);
    }
  });

  it('accepts payload with metadata', () => {
    const payload = {
      ...validPayload,
      metadata: {
        repository: 'owner/repo',
        labels: ['bug', 'urgent'],
      },
    };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('accepts empty logs array', () => {
    const payload = { ...validPayload, logs: [] };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('accepts empty url string', () => {
    const payload = { ...validPayload, url: '' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(true);
  });

  it('rejects missing description', () => {
    const payload = { ...validPayload, description: undefined };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects empty description', () => {
    const payload = { ...validPayload, description: '' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Description is required');
    }
  });

  it('rejects description over 10000 chars', () => {
    const payload = { ...validPayload, description: 'a'.repeat(10001) };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid log level', () => {
    const payload = {
      ...validPayload,
      logs: [
        {
          level: 'debug' as 'error', // invalid level
          message: 'test',
          timestamp: Date.now(),
        },
      ],
    };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects invalid url format', () => {
    const payload = { ...validPayload, url: 'not-a-valid-url' };
    const result = validateBugReport(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing timestamp', () => {
    const { timestamp, ...rest } = validPayload;
    const result = validateBugReport(rest);
    expect(result.success).toBe(false);
  });

  it('rejects missing userAgent', () => {
    const { userAgent, ...rest } = validPayload;
    const result = validateBugReport(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-object payload', () => {
    expect(validateBugReport(null).success).toBe(false);
    expect(validateBugReport('string').success).toBe(false);
    expect(validateBugReport(123).success).toBe(false);
  });
});

describe('BugReportSchema', () => {
  it('parses valid log levels', () => {
    const levels = ['error', 'warn', 'info', 'log'] as const;
    for (const level of levels) {
      const result = BugReportSchema.safeParse({
        description: 'test',
        logs: [{ level, message: 'msg', timestamp: 123 }],
        url: '',
        userAgent: 'test',
        timestamp: 123,
      });
      expect(result.success).toBe(true);
    }
  });

  it('allows optional stack in logs', () => {
    const result = BugReportSchema.safeParse({
      description: 'test',
      logs: [
        { level: 'error', message: 'with stack', timestamp: 123, stack: 'trace' },
        { level: 'warn', message: 'no stack', timestamp: 123 },
      ],
      url: '',
      userAgent: 'test',
      timestamp: 123,
    });
    expect(result.success).toBe(true);
  });
});

vi.mock('@octokit/rest', () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    issues: {
      create: vi.fn().mockResolvedValue({
        data: {
          html_url: 'https://github.com/owner/repo/issues/1',
          number: 1,
        },
      }),
    },
  })),
}));

describe('handleBugReport', () => {
  const validPayload = {
    description: 'Button click throws error',
    logs: [{ level: 'error' as const, message: 'Error occurred', timestamp: Date.now() }],
    url: 'https://example.com/page',
    userAgent: 'Mozilla/5.0',
    timestamp: Date.now(),
  };

  const mockConfig = {
    githubToken: 'test-token',
    repository: 'owner/repo',
  };

  it('returns 400 for invalid payload', async () => {
    const result = await handleBugReport({ description: '' }, mockConfig);
    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it('returns 400 for missing description', async () => {
    const result = await handleBugReport({ logs: [], url: '', userAgent: '', timestamp: 0 }, mockConfig);
    expect(result.status).toBe(400);
  });

  it('returns error when githubToken is missing', async () => {
    const result = await handleBugReport(validPayload, { ...mockConfig, githubToken: '' });
    expect(result.body.success).toBe(false);
    expect(result.body.message).toContain('GITHUB_TOKEN');
  });

  it('returns error for invalid repository format', async () => {
    const result = await handleBugReport(validPayload, { ...mockConfig, repository: 'invalid' });
    expect(result.body.success).toBe(false);
    expect(result.body.message).toContain('owner/repo');
  });
});

describe('createExpressHandler', () => {
  const mockConfig = { githubToken: 'test', repository: 'owner/repo' };

  it('returns 400 when body is undefined', async () => {
    const handler = createExpressHandler(mockConfig);
    const req = { body: undefined };
    let responseStatus = 0;
    let responseBody: unknown = null;
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return {
          json: (body: unknown) => {
            responseBody = body;
          },
        };
      },
    };

    await handler(req, res);

    expect(responseStatus).toBe(400);
    expect(responseBody).toEqual({
      success: false,
      message: expect.stringContaining('body-parser'),
    });
  });

  it('returns 400 when body is null', async () => {
    const handler = createExpressHandler(mockConfig);
    const req = { body: null };
    let responseStatus = 0;
    let responseBody: unknown = null;
    const res = {
      status: (code: number) => {
        responseStatus = code;
        return { json: (body: unknown) => { responseBody = body; } };
      },
    };

    await handler(req, res);

    expect(responseStatus).toBe(400);
    expect(responseBody).toEqual({
      success: false,
      message: expect.stringContaining('body-parser'),
    });
  });
});

describe('createFastifyHandler', () => {
  const mockConfig = { githubToken: 'test', repository: 'owner/repo' };

  it('returns 400 when body is undefined', async () => {
    const handler = createFastifyHandler(mockConfig);
    const request = { body: undefined };
    let responseStatus = 0;
    let responseBody: unknown = null;
    const reply = {
      status: (code: number) => {
        responseStatus = code;
        return { send: (body: unknown) => { responseBody = body; } };
      },
    };

    await handler(request, reply);

    expect(responseStatus).toBe(400);
    expect(responseBody).toEqual({
      success: false,
      message: expect.stringContaining('Content-Type'),
    });
  });

  it('returns 400 when body is null', async () => {
    const handler = createFastifyHandler(mockConfig);
    const request = { body: null };
    let responseStatus = 0;
    let responseBody: unknown = null;
    const reply = {
      status: (code: number) => {
        responseStatus = code;
        return { send: (body: unknown) => { responseBody = body; } };
      },
    };

    await handler(request, reply);

    expect(responseStatus).toBe(400);
  });
});

describe('createKoaHandler', () => {
  const mockConfig = { githubToken: 'test', repository: 'owner/repo' };

  it('returns 400 when body is undefined', async () => {
    const handler = createKoaHandler(mockConfig);
    const ctx = {
      request: { body: undefined },
      status: 0,
      body: null as unknown,
    };

    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toEqual({
      success: false,
      message: expect.stringContaining('koa-bodyparser'),
    });
  });

  it('returns 400 when body is null', async () => {
    const handler = createKoaHandler(mockConfig);
    const ctx = {
      request: { body: null },
      status: 0,
      body: null as unknown,
    };

    await handler(ctx);

    expect(ctx.status).toBe(400);
    expect(ctx.body).toEqual({
      success: false,
      message: expect.stringContaining('koa-bodyparser'),
    });
  });
});

describe('createFetchHandler', () => {
  const mockConfig = { githubToken: 'test', repository: 'owner/repo' };

  it('returns 400 for invalid JSON', async () => {
    const handler = createFetchHandler(mockConfig);
    const request = new Request('http://localhost/api/report', {
      method: 'POST',
      body: 'invalid json',
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handler(request);

    expect(response.status).toBe(500);
  });

  it('returns 400 for missing description', async () => {
    const handler = createFetchHandler(mockConfig);
    const request = new Request('http://localhost/api/report', {
      method: 'POST',
      body: JSON.stringify({ logs: [], url: '', userAgent: '', timestamp: 0 }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await handler(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe('createNodeHandler', () => {
  const mockConfig = { githubToken: 'test', repository: 'owner/repo' };

  function createMockRequest(data: string) {
    const dataCallbacks: ((chunk: Buffer) => void)[] = [];
    const endCallbacks: (() => void)[] = [];
    return {
      on: (event: string, callback: (chunk: Buffer) => void) => {
        if (event === 'data') dataCallbacks.push(callback);
        if (event === 'end') endCallbacks.push(callback as unknown as () => void);
      },
      simulateData: () => {
        dataCallbacks.forEach((cb) => cb(Buffer.from(data)));
        endCallbacks.forEach((cb) => cb());
      },
    };
  }

  function createMockResponse() {
    return {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader: function (name: string, value: string) {
        this.headers[name] = value;
      },
      end: function (body: string) {
        this.body = body;
      },
    };
  }

  it('returns 500 for invalid JSON', async () => {
    const handler = createNodeHandler(mockConfig);
    const req = createMockRequest('not valid json');
    const res = createMockResponse();

    const promise = handler(req, res);
    req.simulateData();
    await promise;

    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).success).toBe(false);
  });

  it('returns 400 for validation error', async () => {
    const handler = createNodeHandler(mockConfig);
    const req = createMockRequest(JSON.stringify({ description: '' }));
    const res = createMockResponse();

    const promise = handler(req, res);
    req.simulateData();
    await promise;

    expect(res.statusCode).toBe(400);
    expect(res.headers['Content-Type']).toBe('application/json');
  });
});
