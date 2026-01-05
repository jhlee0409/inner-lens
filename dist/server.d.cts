import { z } from 'zod';

/**
 * Captured log entry
 */
interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'log';
    message: string;
    timestamp: number;
    stack?: string;
}
/**
 * Types of user actions that can be captured
 */
type UserActionType = 'click' | 'dblclick' | 'input' | 'change' | 'focus' | 'blur' | 'scroll' | 'keydown' | 'submit' | 'copy' | 'paste' | 'select';
/**
 * Captured user action entry
 */
interface UserAction {
    type: UserActionType;
    target: string;
    timestamp: number;
    value?: string;
    position?: {
        x: number;
        y: number;
    };
    key?: string;
    metadata?: Record<string, unknown>;
}
/**
 * Types of navigation events
 */
type NavigationType = 'pageload' | 'pushstate' | 'replacestate' | 'popstate' | 'hashchange' | 'beforeunload';
/**
 * Navigation entry
 */
interface NavigationEntry {
    type: NavigationType;
    timestamp: number;
    from: string;
    to: string;
    duration?: number;
    metadata?: Record<string, unknown>;
}
/**
 * Core Web Vitals metrics
 */
interface CoreWebVitals {
    /** Largest Contentful Paint (ms) */
    LCP?: number;
    /** First Input Delay (ms) */
    FID?: number;
    /** Cumulative Layout Shift */
    CLS?: number;
    /** Interaction to Next Paint (ms) */
    INP?: number;
    /** Time to First Byte (ms) */
    TTFB?: number;
    /** First Contentful Paint (ms) */
    FCP?: number;
}
/**
 * Performance data summary
 */
interface PerformanceSummary {
    coreWebVitals: CoreWebVitals;
    timing: {
        domContentLoaded: number;
        loadComplete: number;
        timeToInteractive?: number;
    };
    resourceCount: number;
    memoryUsage?: number;
    score?: number;
}
/**
 * Page context for better bug location identification
 */
interface PageContext {
    /** Current URL/route when bug occurred */
    route: string;
    /** URL path without query params */
    pathname: string;
    /** URL hash */
    hash: string;
    /** React component stack (from Error Boundary) */
    componentStack?: string;
    /** Document title */
    title: string;
    /** Time spent on current page (ms) */
    timeOnPage: number;
    /** Referrer URL */
    referrer?: string;
}
/**
 * Bug report payload sent to the server
 */
interface BugReportPayload {
    description: string;
    logs: LogEntry[];
    url: string;
    userAgent: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
    owner?: string;
    repo?: string;
    userActions?: UserAction[];
    navigations?: NavigationEntry[];
    performance?: PerformanceSummary;
    sessionReplay?: string;
    pageContext?: PageContext;
}
/**
 * Server response from bug report submission
 */
interface BugReportResponse {
    success: boolean;
    issueUrl?: string;
    issueNumber?: number;
    message?: string;
}
/**
 * GitHub Issue creation payload
 */
interface GitHubIssuePayload {
    title: string;
    body: string;
    labels: string[];
    repository: string;
}

/**
 * Sensitive Data Masking Engine
 * Security-first approach to prevent PII leakage in bug reports
 */
/**
 * Masks sensitive data in the provided text
 * @param text - The text to mask
 * @returns The masked text with sensitive data redacted
 */
declare function maskSensitiveData(text: string): string;
/**
 * Masks sensitive data in an object recursively
 * @param obj - The object to mask
 * @returns A new object with sensitive data masked
 */
declare function maskSensitiveObject<T>(obj: T): T;

/**
 * inner-lens/server
 * Universal server-side utilities for processing bug reports
 * Works with any Node.js backend: Express, Fastify, Hono, Next.js, Nuxt, etc.
 *
 * @packageDocumentation
 */

/**
 * Zod schema for validating incoming bug reports
 */
declare const BugReportSchema: z.ZodObject<{
    description: z.ZodString;
    logs: z.ZodArray<z.ZodObject<{
        level: z.ZodEnum<["error", "warn", "info", "log"]>;
        message: z.ZodString;
        timestamp: z.ZodNumber;
        stack: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        timestamp: number;
        level: "error" | "warn" | "info" | "log";
        stack?: string | undefined;
    }, {
        message: string;
        timestamp: number;
        level: "error" | "warn" | "info" | "log";
        stack?: string | undefined;
    }>, "many">;
    url: z.ZodUnion<[z.ZodString, z.ZodString]>;
    userAgent: z.ZodString;
    timestamp: z.ZodNumber;
    metadata: z.ZodOptional<z.ZodObject<{
        repository: z.ZodOptional<z.ZodString>;
        labels: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        repository?: string | undefined;
        labels?: string[] | undefined;
    }, {
        repository?: string | undefined;
        labels?: string[] | undefined;
    }>>;
    userActions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["click", "dblclick", "input", "change", "focus", "blur", "scroll", "keydown", "submit", "copy", "paste", "select"]>;
        target: z.ZodString;
        timestamp: z.ZodNumber;
        value: z.ZodOptional<z.ZodString>;
        position: z.ZodOptional<z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>>;
        key: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "click" | "dblclick" | "input" | "change" | "focus" | "blur" | "scroll" | "keydown" | "submit" | "copy" | "paste" | "select";
        target: string;
        timestamp: number;
        value?: string | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        key?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        type: "click" | "dblclick" | "input" | "change" | "focus" | "blur" | "scroll" | "keydown" | "submit" | "copy" | "paste" | "select";
        target: string;
        timestamp: number;
        value?: string | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        key?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">>;
    navigations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["pageload", "pushstate", "replacestate", "popstate", "hashchange", "beforeunload"]>;
        timestamp: z.ZodNumber;
        from: z.ZodString;
        to: z.ZodString;
        duration: z.ZodOptional<z.ZodNumber>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "pageload" | "pushstate" | "replacestate" | "popstate" | "hashchange" | "beforeunload";
        timestamp: number;
        from: string;
        to: string;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
    }, {
        type: "pageload" | "pushstate" | "replacestate" | "popstate" | "hashchange" | "beforeunload";
        timestamp: number;
        from: string;
        to: string;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
    }>, "many">>;
    performance: z.ZodOptional<z.ZodObject<{
        coreWebVitals: z.ZodObject<{
            LCP: z.ZodOptional<z.ZodNumber>;
            FID: z.ZodOptional<z.ZodNumber>;
            CLS: z.ZodOptional<z.ZodNumber>;
            INP: z.ZodOptional<z.ZodNumber>;
            TTFB: z.ZodOptional<z.ZodNumber>;
            FCP: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        }, {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        }>;
        timing: z.ZodObject<{
            domContentLoaded: z.ZodNumber;
            loadComplete: z.ZodNumber;
            timeToInteractive: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        }, {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        }>;
        resourceCount: z.ZodNumber;
        memoryUsage: z.ZodOptional<z.ZodNumber>;
        score: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        coreWebVitals: {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        };
        timing: {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        };
        resourceCount: number;
        memoryUsage?: number | undefined;
        score?: number | undefined;
    }, {
        coreWebVitals: {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        };
        timing: {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        };
        resourceCount: number;
        memoryUsage?: number | undefined;
        score?: number | undefined;
    }>>;
    sessionReplay: z.ZodOptional<z.ZodString>;
    pageContext: z.ZodOptional<z.ZodObject<{
        route: z.ZodString;
        pathname: z.ZodString;
        hash: z.ZodString;
        componentStack: z.ZodOptional<z.ZodString>;
        title: z.ZodString;
        timeOnPage: z.ZodNumber;
        referrer: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        route: string;
        pathname: string;
        hash: string;
        title: string;
        timeOnPage: number;
        componentStack?: string | undefined;
        referrer?: string | undefined;
    }, {
        route: string;
        pathname: string;
        hash: string;
        title: string;
        timeOnPage: number;
        componentStack?: string | undefined;
        referrer?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    description: string;
    logs: {
        message: string;
        timestamp: number;
        level: "error" | "warn" | "info" | "log";
        stack?: string | undefined;
    }[];
    url: string;
    userAgent: string;
    metadata?: {
        repository?: string | undefined;
        labels?: string[] | undefined;
    } | undefined;
    userActions?: {
        type: "click" | "dblclick" | "input" | "change" | "focus" | "blur" | "scroll" | "keydown" | "submit" | "copy" | "paste" | "select";
        target: string;
        timestamp: number;
        value?: string | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        key?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
    navigations?: {
        type: "pageload" | "pushstate" | "replacestate" | "popstate" | "hashchange" | "beforeunload";
        timestamp: number;
        from: string;
        to: string;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
    }[] | undefined;
    performance?: {
        coreWebVitals: {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        };
        timing: {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        };
        resourceCount: number;
        memoryUsage?: number | undefined;
        score?: number | undefined;
    } | undefined;
    sessionReplay?: string | undefined;
    pageContext?: {
        route: string;
        pathname: string;
        hash: string;
        title: string;
        timeOnPage: number;
        componentStack?: string | undefined;
        referrer?: string | undefined;
    } | undefined;
}, {
    timestamp: number;
    description: string;
    logs: {
        message: string;
        timestamp: number;
        level: "error" | "warn" | "info" | "log";
        stack?: string | undefined;
    }[];
    url: string;
    userAgent: string;
    metadata?: {
        repository?: string | undefined;
        labels?: string[] | undefined;
    } | undefined;
    userActions?: {
        type: "click" | "dblclick" | "input" | "change" | "focus" | "blur" | "scroll" | "keydown" | "submit" | "copy" | "paste" | "select";
        target: string;
        timestamp: number;
        value?: string | undefined;
        position?: {
            x: number;
            y: number;
        } | undefined;
        key?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
    navigations?: {
        type: "pageload" | "pushstate" | "replacestate" | "popstate" | "hashchange" | "beforeunload";
        timestamp: number;
        from: string;
        to: string;
        metadata?: Record<string, unknown> | undefined;
        duration?: number | undefined;
    }[] | undefined;
    performance?: {
        coreWebVitals: {
            LCP?: number | undefined;
            FID?: number | undefined;
            CLS?: number | undefined;
            INP?: number | undefined;
            TTFB?: number | undefined;
            FCP?: number | undefined;
        };
        timing: {
            domContentLoaded: number;
            loadComplete: number;
            timeToInteractive?: number | undefined;
        };
        resourceCount: number;
        memoryUsage?: number | undefined;
        score?: number | undefined;
    } | undefined;
    sessionReplay?: string | undefined;
    pageContext?: {
        route: string;
        pathname: string;
        hash: string;
        title: string;
        timeOnPage: number;
        componentStack?: string | undefined;
        referrer?: string | undefined;
    } | undefined;
}>;
type ValidatedBugReport = z.infer<typeof BugReportSchema>;
/**
 * Configuration for the issue creator
 */
interface IssueCreatorConfig {
    githubToken: string;
    repository: string;
    defaultLabels?: string[];
}
/**
 * Creates a GitHub issue from a bug report
 */
declare function createGitHubIssue(payload: BugReportPayload, config: IssueCreatorConfig): Promise<BugReportResponse>;
/**
 * Validates a bug report payload
 */
declare function validateBugReport(payload: unknown): {
    success: true;
    data: ValidatedBugReport;
} | {
    success: false;
    error: string;
};
/**
 * Core handler logic - framework agnostic
 * Use this with any backend framework
 */
declare function handleBugReport(body: unknown, config: IssueCreatorConfig): Promise<{
    status: number;
    body: BugReportResponse | {
        success: false;
        message: string;
    };
}>;
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
declare function createFetchHandler(config: IssueCreatorConfig): (request: Request) => Promise<Response>;
declare const createReportHandler: typeof createFetchHandler;
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
declare function createExpressHandler(config: IssueCreatorConfig): (req: {
    body: unknown;
}, res: {
    status: (code: number) => {
        json: (body: unknown) => void;
    };
}) => Promise<void>;
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
declare function createFastifyHandler(config: IssueCreatorConfig): (request: {
    body: unknown;
}, reply: {
    status: (code: number) => {
        send: (body: unknown) => void;
    };
}) => Promise<void>;
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
declare function createKoaHandler(config: IssueCreatorConfig): (ctx: {
    request: {
        body: unknown;
    };
    status: number;
    body: unknown;
}) => Promise<void>;
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
declare function createNodeHandler(config: IssueCreatorConfig): (req: {
    on: (event: string, callback: (chunk: Buffer) => void) => void;
}, res: {
    statusCode: number;
    setHeader: (name: string, value: string) => void;
    end: (body: string) => void;
}) => Promise<void>;

export { type BugReportPayload, type BugReportResponse, BugReportSchema, type GitHubIssuePayload, type IssueCreatorConfig, type ValidatedBugReport, createExpressHandler, createFastifyHandler, createFetchHandler, createGitHubIssue, createKoaHandler, createNodeHandler, createReportHandler, handleBugReport, maskSensitiveData, maskSensitiveObject, validateBugReport };
