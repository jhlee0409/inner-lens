/**
 * inner-lens Cloudflare Worker
 * GitHub 이슈 생성을 위한 서버리스 프록시
 */

interface BugReport {
  description: string;
  logs?: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  sessionReplay?: unknown;
}

interface Env {
  GITHUB_TOKEN: string;
  GITHUB_REPOSITORY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = (await request.json()) as BugReport;

      // Validate required fields
      if (!body.description) {
        return new Response(
          JSON.stringify({ error: 'Description is required' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      // Format issue body
      const issueBody = formatIssueBody(body);

      // Create GitHub issue
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
            title: `[Bug] ${body.description.slice(0, 50)}${body.description.length > 50 ? '...' : ''}`,
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
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }

      const issue = (await response.json()) as { number: number; html_url: string };

      return new Response(
        JSON.stringify({
          success: true,
          issueNumber: issue.number,
          issueUrl: issue.html_url,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Internal server error' }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};

function formatIssueBody(report: BugReport): string {
  const sections: string[] = [];

  // Description
  sections.push(`## Description\n${report.description}`);

  // Environment
  if (report.url || report.userAgent) {
    sections.push(`## Environment
- **URL:** ${report.url || 'N/A'}
- **User Agent:** ${report.userAgent || 'N/A'}
- **Timestamp:** ${report.timestamp || new Date().toISOString()}`);
  }

  // Console Logs
  if (report.logs && report.logs.length > 0) {
    const logsContent = report.logs
      .map((log) => `[${log.type}] ${log.timestamp}: ${log.message}`)
      .join('\n');
    sections.push(`## Console Logs\n\`\`\`\n${logsContent}\n\`\`\``);
  }

  // Session Replay indicator
  if (report.sessionReplay) {
    sections.push(`## Session Replay\n> Session replay data is attached to this report.`);
  }

  // Footer
  sections.push(`---\n*Reported via [inner-lens](https://github.com/jhlee0409/inner-lens)*`);

  return sections.join('\n\n');
}
