/**
 * inner-lens Netlify Function
 * Netlify에 프론트엔드와 함께 배포할 때 사용
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'log';
  message: string;
  timestamp: number;
  stack?: string;
}

interface BugReport {
  description: string;
  logs: LogEntry[];
  url: string;
  userAgent: string;
  timestamp: number;
}

// 민감 데이터 마스킹 패턴
const MASKING_PATTERNS = [
  { pattern: /\b[\w.-]+@[\w.-]+\.\w{2,}\b/gi, replacement: '[EMAIL_REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, replacement: 'Bearer [TOKEN_REDACTED]' },
  { pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/gi, replacement: '[OPENAI_KEY_REDACTED]' },
  { pattern: /\b(sk-ant-[a-zA-Z0-9\-]{20,})\b/gi, replacement: '[ANTHROPIC_KEY_REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, replacement: '[JWT_REDACTED]' },
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[CARD_REDACTED]' },
  { pattern: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/gi, replacement: '[GITHUB_TOKEN_REDACTED]' },
];

function maskSensitiveData(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of MASKING_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

function validateConfig(): { valid: boolean; error?: string } {
  if (!process.env.GITHUB_TOKEN) {
    return { valid: false, error: 'GITHUB_TOKEN is not configured' };
  }
  if (!process.env.GITHUB_REPOSITORY) {
    return { valid: false, error: 'GITHUB_REPOSITORY is not configured' };
  }
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  if (!owner || !repo) {
    return { valid: false, error: 'GITHUB_REPOSITORY must be in "owner/repo" format' };
  }
  return { valid: true };
}

function validateBugReport(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }
  const report = body as Record<string, unknown>;
  if (!report.description || typeof report.description !== 'string') {
    return { valid: false, error: 'Description is required' };
  }
  if (report.description.length > 10000) {
    return { valid: false, error: 'Description is too long (max 10000 characters)' };
  }
  return { valid: true };
}

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // 환경변수 검증
  const configValidation = validateConfig();
  if (!configValidation.valid) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: configValidation.error }),
    };
  }

  try {
    const body = JSON.parse(event.body || '{}');

    // 요청 데이터 검증
    const bodyValidation = validateBugReport(body);
    if (!bodyValidation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: bodyValidation.error }),
      };
    }

    const report = body as BugReport;
    const issueBody = formatIssueBody(report);
    const [owner, repo] = process.env.GITHUB_REPOSITORY!.split('/');

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'inner-lens-netlify',
        },
        body: JSON.stringify({
          title: `[Bug Report] ${report.description.slice(0, 80)}${report.description.length > 80 ? '...' : ''}`,
          body: issueBody,
          labels: ['inner-lens', 'bug'],
        }),
      }
    );

    if (!response.ok) {
      console.error('GitHub API error:', await response.text());
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'Failed to create issue' }),
      };
    }

    const issue = (await response.json()) as { number: number; html_url: string };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
};

function formatIssueBody(report: BugReport): string {
  const sections: string[] = [];

  // Description (마스킹 적용)
  sections.push(`## Bug Report\n\n### Description\n${maskSensitiveData(report.description)}`);

  // Environment
  sections.push(`### Environment
- **URL:** ${report.url || 'N/A'}
- **User Agent:** ${report.userAgent || 'N/A'}
- **Reported At:** ${new Date(report.timestamp).toISOString()}`);

  // Console Logs (최근 20개, 마스킹 적용)
  if (report.logs && report.logs.length > 0) {
    const recentLogs = report.logs.slice(-20);
    const logsContent = recentLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toISOString();
        const masked = maskSensitiveData(log.message);
        const stack = log.stack ? `\n${maskSensitiveData(log.stack)}` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${masked}${stack}`;
      })
      .join('\n');
    sections.push(`### Console Logs\n\`\`\`\n${logsContent}\n\`\`\``);
  } else {
    sections.push(`### Console Logs\n\`\`\`\nNo logs captured\n\`\`\``);
  }

  // Footer
  sections.push(`---\n*This issue was automatically created by [inner-lens](https://github.com/jhlee0409/inner-lens).*\n*Awaiting AI analysis...*`);

  return sections.join('\n\n');
}

export { handler };
