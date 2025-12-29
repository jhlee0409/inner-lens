/**
 * inner-lens/server
 * Server-side utilities for processing bug reports
 *
 * @packageDocumentation
 */

import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import type { BugReportPayload, BugReportResponse, GitHubIssuePayload } from './types';
import { maskSensitiveData } from './utils/masking';

/**
 * Zod schema for validating incoming bug reports
 */
export const BugReportSchema = z.object({
  description: z.string().min(1, 'Description is required').max(10000),
  logs: z.array(
    z.object({
      level: z.enum(['error', 'warn', 'info', 'log']),
      message: z.string(),
      timestamp: z.number(),
      stack: z.string().optional(),
    })
  ),
  url: z.string().url().or(z.string().length(0)),
  userAgent: z.string(),
  timestamp: z.number(),
  metadata: z
    .object({
      repository: z.string().optional(),
      labels: z.array(z.string()).optional(),
    })
    .optional(),
});

export type ValidatedBugReport = z.infer<typeof BugReportSchema>;

/**
 * Configuration for the issue creator
 */
export interface IssueCreatorConfig {
  githubToken: string;
  repository: string; // "owner/repo" format
  defaultLabels?: string[];
}

/**
 * Creates a GitHub issue from a bug report
 */
export async function createGitHubIssue(
  payload: BugReportPayload,
  config: IssueCreatorConfig
): Promise<BugReportResponse> {
  const [owner, repo] = config.repository.split('/');

  if (!owner || !repo) {
    throw new Error(
      'Invalid repository format. Expected "owner/repo".'
    );
  }

  const octokit = new Octokit({
    auth: config.githubToken,
  });

  // Format logs for the issue body
  const formattedLogs = payload.logs
    .slice(-20) // Limit to last 20 logs
    .map((log) => {
      const timestamp = new Date(log.timestamp).toISOString();
      return `[${timestamp}] [${log.level.toUpperCase()}] ${maskSensitiveData(log.message)}${
        log.stack ? `\n${maskSensitiveData(log.stack)}` : ''
      }`;
    })
    .join('\n');

  // Create issue body with structured format
  const issueBody = `## Bug Report

### Description
${maskSensitiveData(payload.description)}

### Environment
- **URL:** ${payload.url || 'N/A'}
- **User Agent:** ${payload.userAgent || 'N/A'}
- **Reported At:** ${new Date(payload.timestamp).toISOString()}

### Console Logs
\`\`\`
${formattedLogs || 'No logs captured'}
\`\`\`

---
*This issue was automatically created by [inner-lens](https://github.com/jhlee0409/inner-lens).*
*Awaiting AI analysis...*
`;

  const title = `[Bug Report] ${payload.description.slice(0, 80)}${
    payload.description.length > 80 ? '...' : ''
  }`;

  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body: issueBody,
      labels: [
        ...(config.defaultLabels ?? ['bug', 'inner-lens']),
        ...((payload.metadata as { labels?: string[] } | undefined)?.labels ?? []),
      ],
    });

    return {
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create GitHub issue';
    return {
      success: false,
      message,
    };
  }
}

/**
 * Validates a bug report payload
 */
export function validateBugReport(
  payload: unknown
): { success: true; data: ValidatedBugReport } | { success: false; error: string } {
  const result = BugReportSchema.safeParse(payload);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errorMessages = result.error.errors
    .map((e) => `${e.path.join('.')}: ${e.message}`)
    .join(', ');

  return { success: false, error: errorMessages };
}

/**
 * Creates a Next.js API route handler for bug reports
 *
 * @example
 * // app/api/inner-lens/report/route.ts
 * import { createReportHandler } from 'inner-lens/server';
 *
 * export const POST = createReportHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * });
 */
export function createReportHandler(config: IssueCreatorConfig) {
  return async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();

      // Validate the payload
      const validation = validateBugReport(body);
      if (!validation.success) {
        return Response.json(
          { success: false, message: validation.error },
          { status: 400 }
        );
      }

      // Create the GitHub issue
      const result = await createGitHubIssue(validation.data, config);

      if (result.success) {
        return Response.json(result, { status: 201 });
      }

      return Response.json(result, { status: 500 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      return Response.json({ success: false, message }, { status: 500 });
    }
  };
}

// Re-export types for convenience
export type {
  BugReportPayload,
  BugReportResponse,
  GitHubIssuePayload,
} from './types';

export { maskSensitiveData, maskSensitiveObject } from './utils/masking';
