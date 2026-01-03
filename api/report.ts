/**
 * Centralized Bug Report API
 * POST /api/report
 *
 * Receives bug reports from inner-lens widgets and creates GitHub issues
 * using the inner-lens GitHub App.
 */

import { App } from '@octokit/app';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { HostedBugReportPayload } from '../src/types';
import { MAX_LOG_ENTRIES } from '../src/types';
import { maskSensitiveData } from '../src/utils/masking';

// Type for the Octokit instance returned by the App
type InstallationOctokit = Awaited<ReturnType<App['getInstallationOctokit']>>;

// Lazy-initialized GitHub App (to avoid crashes on missing env vars)
let _app: App | null = null;

function getApp(): App {
  if (_app) return _app;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    throw new Error(
      'Missing GitHub App configuration. Please set GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY environment variables.'
    );
  }

  _app = new App({
    appId,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  });

  return _app;
}

// Rate limiting (simple in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute

// Note: BugReportPayload type is now imported from '../src/types' as HostedBugReportPayload
// Note: maskSensitiveData is now imported from '../src/utils/masking' for consistency

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

async function getInstallationOctokit(owner: string, repo: string): Promise<InstallationOctokit | null> {
  try {
    const app = getApp();
    // Find the installation for this repository
    const iterator = app.eachInstallation.iterator();

    for await (const { installation } of iterator) {
      try {
        const octokit = await app.getInstallationOctokit(installation.id);

        // Check if this installation has access to the repo
        const { data: repos } = await octokit.request('GET /installation/repositories', {
          per_page: 100,
        });

        const hasAccess = repos.repositories.some(
          (r: { owner: { login: string }; name: string }) =>
            r.owner.login.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase()
        );

        if (hasAccess) {
          return octokit;
        }
      } catch {
        // Continue to next installation
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting installation:', error);
    return null;
  }
}

function formatIssueBody(payload: HostedBugReportPayload): string {
  const maskedDescription = maskSensitiveData(payload.description);
  const maskedLogs =
    payload.logs
      ?.map((log) => ({
        ...log,
        message: maskSensitiveData(log.message),
        stack: log.stack ? maskSensitiveData(log.stack) : undefined,
      }))
      .slice(-MAX_LOG_ENTRIES) || []; // Keep last MAX_LOG_ENTRIES logs

  let body = `## Bug Report

${maskedDescription}

---

### Environment

| Field | Value |
|-------|-------|
| URL | ${payload.url || 'N/A'} |
| User Agent | ${payload.userAgent || 'N/A'} |
| Timestamp | ${payload.timestamp ? new Date(payload.timestamp).toISOString() : new Date().toISOString()} |
`;

  if (maskedLogs.length > 0) {
    body += `
---

### Console Logs

\`\`\`
${maskedLogs.map((log) => `[${log.level.toUpperCase()}] ${log.message}${log.stack ? '\n' + log.stack : ''}`).join('\n')}
\`\`\`
`;
  }

  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    body += `
---

### Metadata

\`\`\`json
${JSON.stringify(payload.metadata, null, 2)}
\`\`\`
`;
  }

  body += `
---

<sub>Reported via [inner-lens](https://github.com/jhlee0409/inner-lens)</sub>
`;

  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    const payload = req.body as HostedBugReportPayload;

    // Validate required fields
    if (!payload.owner || !payload.repo) {
      return res.status(400).json({ error: 'Missing required fields: owner, repo' });
    }

    if (!payload.description || payload.description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Validate description length
    if (payload.description.length > 10000) {
      return res.status(400).json({ error: 'Description too long (max 10000 characters)' });
    }

    // Get Octokit for this installation
    const octokit = await getInstallationOctokit(payload.owner, payload.repo);

    if (!octokit) {
      return res.status(403).json({
        error: 'inner-lens app is not installed on this repository',
        installUrl: `https://github.com/apps/inner-lens-app/installations/new`,
      });
    }

    // Create the issue
    const title = `[Bug Report] ${payload.description.slice(0, 80)}${payload.description.length > 80 ? '...' : ''}`;
    const body = formatIssueBody(payload);

    const { data: issue } = await octokit.request('POST /repos/{owner}/{repo}/issues', {
      owner: payload.owner,
      repo: payload.repo,
      title,
      body,
      labels: ['bug', 'inner-lens'],
    });

    return res.status(201).json({
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    });
  } catch (error) {
    console.error('Error creating issue:', error);

    if (error instanceof Error) {
      // Missing environment variables
      if (error.message.includes('Missing GitHub App configuration')) {
        return res.status(500).json({
          error: 'Server configuration error',
          details: 'GitHub App is not configured. Please contact the administrator.',
        });
      }

      // Repository not found
      if (error.message.includes('Not Found')) {
        return res.status(404).json({ error: 'Repository not found or no access' });
      }

      // Bad credentials
      if (error.message.includes('Bad credentials') || error.message.includes('401')) {
        return res.status(500).json({
          error: 'Authentication error',
          details: 'GitHub App credentials are invalid.',
        });
      }
    }

    return res.status(500).json({ error: 'Failed to create issue' });
  }
}
