/**
 * inner-lens Netlify Function
 * Netlify에 프론트엔드와 함께 배포할 때 사용
 */

import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

interface BugReport {
  description: string;
  logs?: Array<{ type: string; message: string; timestamp: string }>;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  sessionReplay?: unknown;
}

const handler: Handler = async (event: HandlerEvent, _context: HandlerContext) => {
  // CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

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

  try {
    const body = JSON.parse(event.body || '{}') as BugReport;

    if (!body.description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Description is required' }),
      };
    }

    const issueBody = formatIssueBody(body);
    const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');

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
          title: `[Bug] ${body.description.slice(0, 50)}${body.description.length > 50 ? '...' : ''}`,
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
      statusCode: 200,
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

  sections.push(`## Description\n${report.description}`);

  if (report.url || report.userAgent) {
    sections.push(`## Environment
- **URL:** ${report.url || 'N/A'}
- **User Agent:** ${report.userAgent || 'N/A'}
- **Timestamp:** ${report.timestamp || new Date().toISOString()}`);
  }

  if (report.logs && report.logs.length > 0) {
    const logsContent = report.logs
      .map((log) => `[${log.type}] ${log.timestamp}: ${log.message}`)
      .join('\n');
    sections.push(`## Console Logs\n\`\`\`\n${logsContent}\n\`\`\``);
  }

  if (report.sessionReplay) {
    sections.push(`## Session Replay\n> Session replay data is attached.`);
  }

  sections.push(`---\n*Reported via [inner-lens](https://github.com/jhlee0409/inner-lens)*`);

  return sections.join('\n\n');
}

export { handler };
