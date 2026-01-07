/**
 * Centralized Bug Report API
 * POST /api/report
 *
 * Receives bug reports from inner-lens widgets and creates GitHub issues
 * using the inner-lens GitHub App.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { App } from '@octokit/app';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  validateHostedBugReport,
  formatIssueBody,
  type ValidatedHostedBugReport,
  MAX_PAYLOAD_SIZE,
} from './_shared.js';

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

// Rate limiting with Upstash Redis (distributed, works across serverless instances)
// Falls back to in-memory if Upstash is not configured
const RATE_LIMIT_PER_MINUTE = 10;
const DAILY_LIMIT_PER_REPO = 100;

let _redis: Redis | null = null;
let _ipRatelimit: Ratelimit | null = null;
let _redisInitialized = false;

function getRedis(): Redis | null {
  if (_redisInitialized) return _redis;
  _redisInitialized = true;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    console.warn('Upstash Redis not configured. Falling back to in-memory rate limiting.');
    return null;
  }

  try {
    _redis = new Redis({ url: redisUrl, token: redisToken });
    _ipRatelimit = new Ratelimit({
      redis: _redis,
      limiter: Ratelimit.slidingWindow(RATE_LIMIT_PER_MINUTE, '1 m'),
      analytics: true,
      prefix: 'inner-lens:ip',
    });
    return _redis;
  } catch (error) {
    console.error('Failed to initialize Upstash Redis:', error);
    return null;
  }
}

function getIpRatelimit(): Ratelimit | null {
  getRedis();
  return _ipRatelimit;
}

// Fallback in-memory rate limiting (for local dev or when Upstash not configured)
const RATE_WINDOW_MS = 60 * 1000;
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const repoUsageMap = new Map<string, { count: number; resetAt: number }>();

function checkIpRateLimitInMemory(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_PER_MINUTE) {
    return false;
  }

  entry.count++;
  return true;
}

function checkRepoLimitInMemory(repoKey: string): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const midnight = new Date();
  midnight.setHours(24, 0, 0, 0);
  const resetAt = midnight.getTime();

  const entry = repoUsageMap.get(repoKey);

  if (!entry || now > entry.resetAt) {
    repoUsageMap.set(repoKey, { count: 1, resetAt });
    return { success: true, remaining: DAILY_LIMIT_PER_REPO - 1, resetAt };
  }

  if (entry.count >= DAILY_LIMIT_PER_REPO) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { success: true, remaining: DAILY_LIMIT_PER_REPO - entry.count, resetAt: entry.resetAt };
}

async function checkIpRateLimit(ip: string): Promise<{ success: boolean; reset?: number }> {
  const ratelimit = getIpRatelimit();

  if (ratelimit) {
    const result = await ratelimit.limit(ip);
    return { success: result.success, reset: result.reset };
  }

  return { success: checkIpRateLimitInMemory(ip) };
}

async function checkDailyRepoLimit(owner: string, repo: string): Promise<{ 
  success: boolean; 
  remaining: number; 
  resetAt: number;
  dailyLimit: number;
}> {
  const repoKey = `${owner}/${repo}`.toLowerCase();
  const redis = getRedis();

  if (redis) {
    const redisKey = `inner-lens:daily:${repoKey}`;
    const now = Date.now();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const ttlSeconds = Math.ceil((midnight.getTime() - now) / 1000);

    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.expire(redisKey, ttlSeconds);
    }

    const remaining = Math.max(0, DAILY_LIMIT_PER_REPO - current);
    return {
      success: current <= DAILY_LIMIT_PER_REPO,
      remaining,
      resetAt: midnight.getTime(),
      dailyLimit: DAILY_LIMIT_PER_REPO,
    };
  }

  const result = checkRepoLimitInMemory(repoKey);
  return { ...result, dailyLimit: DAILY_LIMIT_PER_REPO };
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

  const clientIp = (
    (req.headers['x-real-ip'] as string) ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown'
  );
  const ipRateLimitResult = await checkIpRateLimit(clientIp);
  if (!ipRateLimitResult.success) {
    const retryAfter = ipRateLimitResult.reset 
      ? Math.ceil((ipRateLimitResult.reset - Date.now()) / 1000) 
      : 60;
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({ 
      error: 'Too many requests. Please try again later.',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
    });
  }

  try {
    const payloadSize = JSON.stringify(req.body).length;
    if (payloadSize > MAX_PAYLOAD_SIZE) {
      return res.status(413).json({ 
        error: `Payload too large (${Math.round(payloadSize / 1024 / 1024)}MB). Maximum allowed: 10MB.`,
        errorCode: 'PAYLOAD_TOO_LARGE',
      });
    }

    const validation = validateHostedBugReport(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }
    const payload = validation.data;

    const dailyLimitResult = await checkDailyRepoLimit(payload.owner, payload.repo);
    if (!dailyLimitResult.success) {
      return res.status(429).json({
        error: 'Daily limit exceeded for this repository',
        errorCode: 'DAILY_LIMIT_EXCEEDED',
        remaining: 0,
        dailyLimit: dailyLimitResult.dailyLimit,
        resetAt: dailyLimitResult.resetAt,
      });
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
      remaining: dailyLimitResult.remaining,
      dailyLimit: dailyLimitResult.dailyLimit,
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
