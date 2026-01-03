/**
 * Centralized Bug Report API
 * POST /api/report
 *
 * Receives bug reports from inner-lens widgets and creates GitHub issues
 * using the inner-lens GitHub App.
 */

import { App, Octokit } from '@octokit/app';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// GitHub App configuration (set in Vercel environment variables)
const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n'),
});

// Rate limiting (simple in-memory, consider Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // requests per minute per IP
const RATE_WINDOW = 60 * 1000; // 1 minute

interface BugReportPayload {
  // Required: Repository info
  owner: string;
  repo: string;

  // Required: Bug details
  description: string;

  // Optional: Additional context
  logs?: Array<{
    level: 'error' | 'warn' | 'info' | 'log';
    message: string;
    timestamp: number;
    stack?: string;
  }>;
  url?: string;
  userAgent?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
  sessionReplay?: string; // Base64 encoded rrweb data
}

// Sensitive data masking patterns
const MASKING_PATTERNS = [
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]' },
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: '[PHONE]' },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: '[SSN]' },
  { pattern: /\b(?:sk-|pk_live_|pk_test_|sk_live_|sk_test_)[a-zA-Z0-9]{20,}\b/g, replacement: '[API_KEY]' },
  { pattern: /\bBearer\s+[a-zA-Z0-9._-]+\b/gi, replacement: 'Bearer [TOKEN]' },
  { pattern: /\beyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, replacement: '[JWT]' },
];

function maskSensitiveData(text: string): string {
  let masked = text;
  for (const { pattern, replacement } of MASKING_PATTERNS) {
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

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

async function getInstallationOctokit(owner: string, repo: string): Promise<Octokit | null> {
  try {
    // Find the installation for this repository
    const iterator = app.eachInstallation.iterator();

    for await (const { installation } of iterator) {
      try {
        const octokit = await app.getInstallationOctokit(installation.id);

        // Check if this installation has access to the repo
        const { data: repos } = await octokit.apps.listReposAccessibleToInstallation({
          per_page: 100,
        });

        const hasAccess = repos.repositories.some(
          (r) => r.owner.login.toLowerCase() === owner.toLowerCase() && r.name.toLowerCase() === repo.toLowerCase()
        );

        if (hasAccess) {
          return octokit as Octokit;
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

function formatIssueBody(payload: BugReportPayload): string {
  const maskedDescription = maskSensitiveData(payload.description);
  const maskedLogs =
    payload.logs
      ?.map((log) => ({
        ...log,
        message: maskSensitiveData(log.message),
        stack: log.stack ? maskSensitiveData(log.stack) : undefined,
      }))
      .slice(-50) || []; // Keep last 50 logs

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
    const payload = req.body as BugReportPayload;

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
        installUrl: `https://github.com/apps/inner-lens/installations/new?target_id=${payload.owner}`,
      });
    }

    // Create the issue
    const title = `[Bug Report] ${payload.description.slice(0, 80)}${payload.description.length > 80 ? '...' : ''}`;
    const body = formatIssueBody(payload);

    const { data: issue } = await octokit.issues.create({
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

    if (error instanceof Error && error.message.includes('Not Found')) {
      return res.status(404).json({ error: 'Repository not found or no access' });
    }

    return res.status(500).json({ error: 'Failed to create issue' });
  }
}
