/**
 * inner-lens/server
 * Universal server-side utilities for processing bug reports
 * Works with any Node.js backend: Express, Fastify, Hono, Next.js, Nuxt, etc.
 *
 * @packageDocumentation
 */

import { Octokit } from '@octokit/rest';
import { z } from 'zod';
import type { BugReportPayload, BugReportResponse, GitHubIssuePayload } from './types';
import { MAX_LOG_ENTRIES, MAX_SESSION_REPLAY_SIZE, MAX_PAYLOAD_SIZE } from './types';
import { maskSensitiveData } from './utils/masking';

/**
 * Zod schema for user actions
 */
const UserActionSchema = z.object({
  type: z.enum([
    'click',
    'dblclick',
    'input',
    'change',
    'focus',
    'blur',
    'scroll',
    'keydown',
    'submit',
    'copy',
    'paste',
    'select',
  ]),
  target: z.string(),
  timestamp: z.number(),
  value: z.string().optional(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  key: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for navigation entries
 */
const NavigationEntrySchema = z.object({
  type: z.enum([
    'pageload',
    'pushstate',
    'replacestate',
    'popstate',
    'hashchange',
    'beforeunload',
  ]),
  timestamp: z.number(),
  from: z.string(),
  to: z.string(),
  duration: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for performance summary
 */
const PerformanceSummarySchema = z.object({
  coreWebVitals: z.object({
    LCP: z.number().optional(),
    FID: z.number().optional(),
    CLS: z.number().optional(),
    INP: z.number().optional(),
    TTFB: z.number().optional(),
    FCP: z.number().optional(),
  }),
  timing: z.object({
    domContentLoaded: z.number(),
    loadComplete: z.number(),
    timeToInteractive: z.number().optional(),
  }),
  resourceCount: z.number(),
  memoryUsage: z.number().optional(),
  score: z.number().optional(),
});

/**
 * Zod schema for page context
 */
const PageContextSchema = z.object({
  route: z.string(),
  pathname: z.string(),
  hash: z.string(),
  componentStack: z.string().optional(),
  title: z.string(),
  timeOnPage: z.number(),
  referrer: z.string().optional(),
});

/**
 * Zod schema for validating incoming bug reports
 */
const VersionInfoSchema = z.object({
  widget: z.string().optional(),
  sdk: z.string().optional(),
});

const DeploymentInfoSchema = z.object({
  environment: z.string().optional(),
  commit: z.string().optional(),
  release: z.string().optional(),
  buildTime: z.string().optional(),
});

const RuntimeViewportSchema = z.object({
  width: z.number(),
  height: z.number(),
  devicePixelRatio: z.number().optional(),
});

const RuntimeEnvironmentSchema = z.object({
  locale: z.string().optional(),
  language: z.string().optional(),
  timezoneOffset: z.number().optional(),
  viewport: RuntimeViewportSchema.optional(),
  device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  colorScheme: z.enum(['light', 'dark', 'no-preference']).optional(),
  online: z.boolean().optional(),
  platform: z.string().optional(),
});

export const BugReportSchema = z.object({
  description: z.string().min(1, 'Description is required').max(10000),
  logs: z.array(
    z.object({
      level: z.enum(['error', 'warn', 'info', 'log']),
      message: z.string(),
      timestamp: z.number(),
      stack: z.string().optional(),
    })
  ).optional(),
  url: z.string().url().or(z.string().length(0)).optional(),
  userAgent: z.string().optional(),
  timestamp: z.number().optional(),
  owner: z.string().optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  metadata: z
    .object({
      repository: z.string().optional(),
      labels: z.array(z.string()).optional(),
    })
    .optional(),
  version: VersionInfoSchema.optional(),
  deployment: DeploymentInfoSchema.optional(),
  runtime: RuntimeEnvironmentSchema.optional(),
  userActions: z.array(UserActionSchema).optional(),
  navigations: z.array(NavigationEntrySchema).optional(),
  performance: PerformanceSummarySchema.optional(),
  sessionReplay: z.string().max(MAX_SESSION_REPLAY_SIZE, 'Session replay data exceeds 5MB limit').optional(),
  pageContext: PageContextSchema.optional(),
  reporter: z.object({
    name: z.string(),
    email: z.string().optional(),
    id: z.string().optional(),
  }).optional(),
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
 * Error messages with troubleshooting hints
 */
const ERROR_MESSAGES = {
  INVALID_REPO_FORMAT: (repo: string) =>
    `Invalid repository format: "${repo}". Expected "owner/repo" format (e.g., "jhlee0409/inner-lens"). ` +
    `See: https://github.com/jhlee0409/inner-lens#troubleshooting`,

  MISSING_TOKEN:
    'GITHUB_TOKEN is not configured. Create a token at https://github.com/settings/tokens/new?scopes=repo ' +
    'and add it to your environment variables. See: https://github.com/jhlee0409/inner-lens#-backend-setup',

  TOKEN_UNAUTHORIZED:
    'GITHUB_TOKEN is invalid or expired. Generate a new token at https://github.com/settings/tokens/new?scopes=repo',

  REPO_NOT_FOUND: (repo: string) =>
    `Repository "${repo}" not found. Check that the repository exists and your token has access. ` +
    `For private repos, ensure the token has "repo" scope.`,

  RATE_LIMITED:
    'GitHub API rate limit exceeded. Wait a few minutes and try again, or use an authenticated token for higher limits.',

  NETWORK_ERROR: (message: string) =>
    `Network error connecting to GitHub: ${message}. Check your internet connection and try again.`,

  INTERNAL_ERROR: (message: string) =>
    `Internal server error: ${message}. If this persists, please report at https://github.com/jhlee0409/inner-lens/issues`,
};

/**
 * Creates a GitHub issue from a bug report
 */
export async function createGitHubIssue(
  payload: BugReportPayload,
  config: IssueCreatorConfig
): Promise<BugReportResponse> {
  // Validate token
  if (!config.githubToken) {
    return {
      success: false,
      message: ERROR_MESSAGES.MISSING_TOKEN,
    };
  }

  // Validate repository format
  const [owner, repo] = config.repository.split('/');

  if (!owner || !repo || config.repository.split('/').length !== 2) {
    return {
      success: false,
      message: ERROR_MESSAGES.INVALID_REPO_FORMAT(config.repository),
    };
  }

  const octokit = new Octokit({
    auth: config.githubToken,
  });

  // Format logs for the issue body
  const maskedLogs = (payload.logs ?? []).map((log) => ({
    ...log,
    message: maskSensitiveData(log.message),
    stack: log.stack ? maskSensitiveData(log.stack) : undefined,
    timestamp: log.timestamp ?? Date.now(),
  }));

  const formattedLogs = maskedLogs.length
    ? maskedLogs
        .slice(-MAX_LOG_ENTRIES)
        .map((log) => {
          const timestamp = new Date(log.timestamp ?? Date.now()).toISOString();
          return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${
            log.stack ? `\n${log.stack}` : ''
          }`;
        })
        .join('\n')
    : null;





  // Format user actions
  const formattedUserActions = payload.userActions?.length
    ? payload.userActions.slice(-20).map((action) => {
        const time = new Date(action.timestamp).toISOString();
        const value = action.value ? ` → "${maskSensitiveData(action.value.slice(0, 50))}"` : '';
        return `[${time}] ${action.type.toUpperCase()} on ${action.target}${value}`;
      }).join('\n')
    : null;

  // Format navigations
  const formattedNavigations = payload.navigations?.length
    ? payload.navigations.slice(-10).map((nav) => {
        const time = new Date(nav.timestamp).toISOString();
        const duration = nav.duration ? ` (${nav.duration}ms)` : '';
        return `[${time}] ${nav.type}: ${maskSensitiveData(nav.from)} → ${maskSensitiveData(nav.to)}${duration}`;
      }).join('\n')
    : null;

  // Format performance
  const formattedPerformance = payload.performance
    ? [
        `LCP: ${payload.performance.coreWebVitals.LCP?.toFixed(0) ?? 'N/A'}ms`,
        `FID: ${payload.performance.coreWebVitals.FID?.toFixed(0) ?? 'N/A'}ms`,
        `CLS: ${payload.performance.coreWebVitals.CLS?.toFixed(3) ?? 'N/A'}`,
        `TTFB: ${payload.performance.coreWebVitals.TTFB?.toFixed(0) ?? 'N/A'}ms`,
        `DOM Loaded: ${payload.performance.timing.domContentLoaded}ms`,
        `Load Complete: ${payload.performance.timing.loadComplete}ms`,
        `Resources: ${payload.performance.resourceCount}`,
      ].join(' | ')
    : null;

  // Format page context
  const formattedPageContext = payload.pageContext
    ? [
        `**Route:** ${maskSensitiveData(payload.pageContext.pathname)}`,
        `**Title:** ${payload.pageContext.title}`,
        `**Time on Page:** ${(payload.pageContext.timeOnPage / 1000).toFixed(1)}s`,
        payload.pageContext.componentStack ? `**Component:** ${payload.pageContext.componentStack}` : null,
      ].filter(Boolean).join('\n')
    : null;

  // Format reporter
  const formattedReporter = payload.reporter
    ? [
        `**Name:** ${payload.reporter.name}`,
        payload.reporter.email ? `**Email:** ${maskSensitiveData(payload.reporter.email)}` : null,
        payload.reporter.id ? `**ID:** ${payload.reporter.id}` : null,
      ].filter(Boolean).join(' | ')
    : null;

  let issueBody = `## Bug Report

### Description
${maskSensitiveData(payload.description)}
`;

  if (payload.branch) {
    issueBody += `
### Branch
**${payload.branch}**
`;
  }

  if (formattedReporter) {
    issueBody += `
### Reporter
${formattedReporter}
`;
  }

  const reportedAt = payload.timestamp ?? Date.now();

  const versionRows = payload.version
    ? `| Widget | ${payload.version.widget ?? 'N/A'} |
| SDK | ${payload.version.sdk ?? payload.version.widget ?? 'N/A'} |
`
    : `| Widget | N/A |
| SDK | N/A |
`;

  const deploymentRows = payload.deployment
    ? `| Environment | ${payload.deployment.environment ?? 'N/A'} |
| Commit | ${payload.deployment.commit ?? 'N/A'} |
| Release | ${payload.deployment.release ?? 'N/A'} |
| Build Time | ${payload.deployment.buildTime ?? 'N/A'} |
`
    : `| Environment | N/A |
| Commit | N/A |
| Release | N/A |
| Build Time | N/A |
`;

  const runtimeRows = payload.runtime
    ? `| Locale | ${payload.runtime.locale ?? payload.runtime.language ?? 'N/A'} |
| Timezone Offset | ${payload.runtime.timezoneOffset ?? 'N/A'} |
| Viewport | ${payload.runtime.viewport ? `${payload.runtime.viewport.width}x${payload.runtime.viewport.height}${payload.runtime.viewport.devicePixelRatio ? ` @${payload.runtime.viewport.devicePixelRatio}x` : ''}` : 'N/A'} |
| Device | ${payload.runtime.device ?? 'N/A'} |
| Color Scheme | ${payload.runtime.colorScheme ?? 'N/A'} |
| Online | ${payload.runtime.online ?? 'N/A'} |
| Platform | ${payload.runtime.platform ?? 'N/A'} |
`
    : `| Locale | N/A |
| Timezone Offset | N/A |
| Viewport | N/A |
| Device | N/A |
| Color Scheme | N/A |
| Online | N/A |
| Platform | N/A |
`;

  const branchRow = payload.branch ? `| Branch | ${payload.branch} |
` : '';

  issueBody += `
### Versions

| Field | Value |
|-------|-------|
${versionRows}
### Deployment

| Field | Value |
|-------|-------|
${deploymentRows}
### Environment

| Field | Value |
|-------|-------|
| URL | ${maskSensitiveData(payload.url || 'N/A')} |
| User Agent | ${payload.userAgent || 'N/A'} |
| Timestamp | ${new Date(reportedAt).toISOString()} |
${branchRow}${runtimeRows}`;

  if (formattedPageContext) {
    issueBody += `
### Page Context
${formattedPageContext}
`;
  }

  if (formattedPerformance) {
    issueBody += `
### Performance
${formattedPerformance}
`;
  }

  issueBody += `
<details>
<summary><b>Console Logs (${payload.logs?.length ?? 0} entries)</b></summary>

\`\`\`
${formattedLogs || 'No logs captured'}
\`\`\`

</details>
`;

  if (formattedUserActions) {
    issueBody += `
<details>
<summary><b>User Actions (${payload.userActions?.length ?? 0} events)</b></summary>

\`\`\`
${formattedUserActions}
\`\`\`

</details>
`;
  }

  if (formattedNavigations) {
    issueBody += `
<details>
<summary><b>Navigation History (${payload.navigations?.length ?? 0} entries)</b></summary>

\`\`\`
${formattedNavigations}
\`\`\`

</details>
`;
  }

  if (payload.sessionReplay) {
    issueBody += `
### Session Replay
📹 Session replay data attached (${(payload.sessionReplay.length / 1024).toFixed(1)}KB compressed)
`;
  }

  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    issueBody += `
---

### Metadata

\`\`\`json
${maskSensitiveData(JSON.stringify(payload.metadata, null, 2))}
\`\`\`
`;
  }

  issueBody += `
---
*This issue was automatically created by [inner-lens](https://github.com/jhlee0409/inner-lens).*
*Awaiting AI analysis...*
`;

  const title = `${payload.description.slice(0, 80)}${
    payload.description.length > 80 ? '...' : ''
  }`;

  try {
    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body: issueBody,
      labels: [
        ...(config.defaultLabels ?? ['inner-lens']),
        ...((payload.metadata as { labels?: string[] } | undefined)?.labels ?? []),
      ],
    });

    return {
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number,
    };
  } catch (error) {
    // Handle specific GitHub API errors
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();

      // Unauthorized (401) - invalid token
      if (errorMessage.includes('bad credentials') || errorMessage.includes('401')) {
        return {
          success: false,
          message: ERROR_MESSAGES.TOKEN_UNAUTHORIZED,
        };
      }

      // Not Found (404) - repo doesn't exist or no access
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        return {
          success: false,
          message: ERROR_MESSAGES.REPO_NOT_FOUND(config.repository),
        };
      }

      // Rate Limited (403)
      if (errorMessage.includes('rate limit') || errorMessage.includes('403')) {
        return {
          success: false,
          message: ERROR_MESSAGES.RATE_LIMITED,
        };
      }

      // Network errors
      if (
        errorMessage.includes('enotfound') ||
        errorMessage.includes('econnrefused') ||
        errorMessage.includes('network')
      ) {
        return {
          success: false,
          message: ERROR_MESSAGES.NETWORK_ERROR(error.message),
        };
      }

      return {
        success: false,
        message: ERROR_MESSAGES.INTERNAL_ERROR(error.message),
      };
    }

    return {
      success: false,
      message: ERROR_MESSAGES.INTERNAL_ERROR('Unknown error occurred'),
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
 * Core handler logic - framework agnostic
 * Use this with any backend framework
 */
export async function handleBugReport(
  body: unknown,
  config: IssueCreatorConfig
): Promise<{ status: number; body: BugReportResponse | { success: false; message: string } }> {
  const payloadSize = JSON.stringify(body).length;
  if (payloadSize > MAX_PAYLOAD_SIZE) {
    return {
      status: 413,
      body: { success: false, message: `Payload too large (${Math.round(payloadSize / 1024 / 1024)}MB). Maximum allowed: 10MB.` },
    };
  }

  const validation = validateBugReport(body);

  if (!validation.success) {
    return {
      status: 400,
      body: { success: false, message: validation.error },
    };
  }

  const result = await createGitHubIssue(validation.data, config);

  return {
    status: result.success ? 201 : 500,
    body: result,
  };
}

// ============================================
// Framework-Specific Adapters
// ============================================

/**
 * Web Standards Fetch API handler (Next.js App Router, Hono, Bun, Deno, Cloudflare Workers)
 *
 * @example
 * ```ts
 * // Next.js App Router: app/api/inner-lens/report/route.ts
 * import { createFetchHandler } from 'inner-lens/server';
 *
 * export const POST = createFetchHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * });
 * ```
 *
 * @example
 * ```ts
 * // Hono
 * import { Hono } from 'hono';
 * import { createFetchHandler } from 'inner-lens/server';
 *
 * const app = new Hono();
 * const handler = createFetchHandler({ ... });
 *
 * app.post('/api/inner-lens/report', (c) => handler(c.req.raw));
 * ```
 */
export function createFetchHandler(config: IssueCreatorConfig) {
  return async (request: Request): Promise<Response> => {
    try {
      const body = await request.json();
      const result = await handleBugReport(body, config);

      return Response.json(result.body, { status: result.status });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      return Response.json({ success: false, message }, { status: 500 });
    }
  };
}

// Alias for backwards compatibility
export const createReportHandler = createFetchHandler;

/**
 * Express/Connect middleware
 *
 * @example
 * ```ts
 * import express from 'express';
 * import { createExpressHandler } from 'inner-lens/server';
 *
 * const app = express();
 * app.use(express.json());
 *
 * app.post('/api/inner-lens/report', createExpressHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * }));
 * ```
 */
export function createExpressHandler(config: IssueCreatorConfig) {
  return async (
    req: { body: unknown },
    res: { status: (code: number) => { json: (body: unknown) => void } }
  ): Promise<void> => {
    try {
      if (req.body === undefined || req.body === null) {
        res.status(400).json({
          success: false,
          message:
            'Request body is missing. Make sure body-parser middleware is configured. ' +
            'Example: app.use(express.json())',
        });
        return;
      }

      const result = await handleBugReport(req.body, config);
      res.status(result.status).json(result.body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ success: false, message });
    }
  };
}

/**
 * Fastify handler
 *
 * @example
 * ```ts
 * import Fastify from 'fastify';
 * import { createFastifyHandler } from 'inner-lens/server';
 *
 * const fastify = Fastify();
 *
 * fastify.post('/api/inner-lens/report', createFastifyHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * }));
 * ```
 */
export function createFastifyHandler(config: IssueCreatorConfig) {
  return async (
    request: { body: unknown },
    reply: { status: (code: number) => { send: (body: unknown) => void } }
  ): Promise<void> => {
    try {
      if (request.body === undefined || request.body === null) {
        reply.status(400).send({
          success: false,
          message: 'Request body is missing. Ensure Content-Type is application/json.',
        });
        return;
      }

      const result = await handleBugReport(request.body, config);
      reply.status(result.status).send(result.body);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      reply.status(500).send({ success: false, message });
    }
  };
}

/**
 * Koa middleware
 *
 * @example
 * ```ts
 * import Koa from 'koa';
 * import bodyParser from 'koa-bodyparser';
 * import { createKoaHandler } from 'inner-lens/server';
 *
 * const app = new Koa();
 * app.use(bodyParser());
 *
 * const handler = createKoaHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * });
 *
 * app.use(async (ctx, next) => {
 *   if (ctx.path === '/api/inner-lens/report' && ctx.method === 'POST') {
 *     await handler(ctx);
 *   } else {
 *     await next();
 *   }
 * });
 * ```
 */
export function createKoaHandler(config: IssueCreatorConfig) {
  return async (ctx: {
    request: { body: unknown };
    status: number;
    body: unknown;
  }): Promise<void> => {
    try {
      if (ctx.request.body === undefined || ctx.request.body === null) {
        ctx.status = 400;
        ctx.body = {
          success: false,
          message:
            'Request body is missing. Make sure koa-bodyparser middleware is configured. ' +
            'Example: app.use(bodyParser())',
        };
        return;
      }

      const result = await handleBugReport(ctx.request.body, config);
      ctx.status = result.status;
      ctx.body = result.body;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Internal server error';
      ctx.status = 500;
      ctx.body = { success: false, message };
    }
  };
}

/**
 * Generic Node.js HTTP handler (http/https modules)
 *
 * @example
 * ```ts
 * import http from 'http';
 * import { createNodeHandler } from 'inner-lens/server';
 *
 * const handler = createNodeHandler({
 *   githubToken: process.env.GITHUB_TOKEN!,
 *   repository: 'owner/repo',
 * });
 *
 * const server = http.createServer(async (req, res) => {
 *   if (req.url === '/api/inner-lens/report' && req.method === 'POST') {
 *     await handler(req, res);
 *   }
 * });
 * ```
 */
export function createNodeHandler(config: IssueCreatorConfig) {
  return async (
    req: { on: (event: string, callback: (chunk: Buffer) => void) => void },
    res: {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body: string) => void;
    }
  ): Promise<void> => {
    const chunks: Buffer[] = [];

    return new Promise((resolve) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', async () => {
        try {
          const bodyStr = Buffer.concat(chunks).toString();
          const body = JSON.parse(bodyStr);
          const result = await handleBugReport(body, config);

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Internal server error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, message }));
        }
        resolve();
      });
    });
  };
}

// Re-export types for convenience
export type {
  BugReportPayload,
  BugReportResponse,
  GitHubIssuePayload,
  LogEntry,
  UserAction,
  UserActionType,
  NavigationEntry,
  NavigationType,
  PerformanceSummary,
  CoreWebVitals,
  PageContext,
  Reporter,
} from './types';

export { maskSensitiveData, maskSensitiveObject } from './utils/masking';
