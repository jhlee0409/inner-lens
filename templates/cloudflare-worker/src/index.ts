/**
 * inner-lens Cloudflare Worker
 * GitHub 이슈 생성을 위한 서버리스 프록시
 */

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

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
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

function validateConfig(env: Env): { valid: boolean; error?: string } {
  if (!env.GITHUB_TOKEN) {
    return { valid: false, error: 'GITHUB_TOKEN is not configured' };
  }
  if (!env.GITHUB_REPOSITORY) {
    return { valid: false, error: 'GITHUB_REPOSITORY is not configured' };
  }
  const [owner, repo] = env.GITHUB_REPOSITORY.split('/');
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: corsHeaders }
      );
    }

    // 환경변수 검증
    const configValidation = validateConfig(env);
    if (!configValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: configValidation.error }),
        { status: 500, headers: corsHeaders }
      );
    }

    try {
      const body = await request.json();

      // 요청 데이터 검증
      const bodyValidation = validateBugReport(body);
      if (!bodyValidation.valid) {
        return new Response(
          JSON.stringify({ error: bodyValidation.error }),
          { status: 400, headers: corsHeaders }
        );
      }

      const report = body as BugReport;
      const issueBody = formatIssueBody(report);
      const [owner, repo] = env.GITHUB_REPOSITORY.split('/');

      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'inner-lens-worker',
          },
          body: JSON.stringify({
            title: `[Bug Report] ${report.description.slice(0, 80)}${report.description.length > 80 ? '...' : ''}`,
            body: issueBody,
            labels: ['inner-lens', 'bug'],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('GitHub API error:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create issue' }),
          { status: 500, headers: corsHeaders }
        );
      }

      const issue = (await response.json()) as { number: number; html_url: string };

      return new Response(
        JSON.stringify({
          success: true,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
        }),
        { status: 201, headers: corsHeaders }
      );
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
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
