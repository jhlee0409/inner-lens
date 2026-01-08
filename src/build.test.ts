import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getGitBranch, getGitCommit, getDeploymentInfo } from './build';

describe('build utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Clear all relevant env vars
    const envVars = [
      'VERCEL_GIT_COMMIT_REF',
      'BRANCH',
      'AWS_BRANCH',
      'CF_PAGES_BRANCH',
      'RENDER_GIT_BRANCH',
      'RAILWAY_GIT_BRANCH',
      'GITHUB_REF_NAME',
      'HEROKU_BRANCH',
      'VERCEL_GIT_COMMIT_SHA',
      'COMMIT_REF',
      'AWS_COMMIT_ID',
      'CF_PAGES_COMMIT_SHA',
      'RENDER_GIT_COMMIT',
      'RAILWAY_GIT_COMMIT_SHA',
      'GITHUB_SHA',
      'HEROKU_SLUG_COMMIT',
      'VERCEL_ENV',
      'CONTEXT',
      'RAILWAY_ENVIRONMENT',
      'NODE_ENV',
    ];
    envVars.forEach((v) => delete process.env[v]);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getGitBranch', () => {
    it('returns "main" as fallback when no env vars set', () => {
      expect(getGitBranch()).toBe('main');
    });

    it('returns VERCEL_GIT_COMMIT_REF when set (highest priority)', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature/vercel-test';
      process.env.BRANCH = 'netlify-branch';
      expect(getGitBranch()).toBe('feature/vercel-test');
    });

    it('returns BRANCH (Netlify) when set', () => {
      process.env.BRANCH = 'staging';
      expect(getGitBranch()).toBe('staging');
    });

    it('returns AWS_BRANCH when set', () => {
      process.env.AWS_BRANCH = 'develop';
      expect(getGitBranch()).toBe('develop');
    });

    it('returns CF_PAGES_BRANCH (Cloudflare Pages) when set', () => {
      process.env.CF_PAGES_BRANCH = 'preview/cf-test';
      expect(getGitBranch()).toBe('preview/cf-test');
    });

    it('returns RENDER_GIT_BRANCH when set', () => {
      process.env.RENDER_GIT_BRANCH = 'render-branch';
      expect(getGitBranch()).toBe('render-branch');
    });

    it('returns RAILWAY_GIT_BRANCH when set', () => {
      process.env.RAILWAY_GIT_BRANCH = 'railway-main';
      expect(getGitBranch()).toBe('railway-main');
    });

    it('returns GITHUB_REF_NAME when set', () => {
      process.env.GITHUB_REF_NAME = 'refs/heads/feature';
      expect(getGitBranch()).toBe('refs/heads/feature');
    });

    it('returns HEROKU_BRANCH when set', () => {
      process.env.HEROKU_BRANCH = 'heroku-deploy';
      expect(getGitBranch()).toBe('heroku-deploy');
    });

    it('respects priority order (first match wins)', () => {
      process.env.GITHUB_REF_NAME = 'github';
      process.env.HEROKU_BRANCH = 'heroku';
      expect(getGitBranch()).toBe('github');
    });
  });

  describe('getGitCommit', () => {
    it('returns empty string as fallback when no env vars set', () => {
      expect(getGitCommit()).toBe('');
    });

    it('returns VERCEL_GIT_COMMIT_SHA when set', () => {
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123def456';
      expect(getGitCommit()).toBe('abc123def456');
    });

    it('returns COMMIT_REF (Netlify) when set', () => {
      process.env.COMMIT_REF = 'netlify-sha-123';
      expect(getGitCommit()).toBe('netlify-sha-123');
    });

    it('returns AWS_COMMIT_ID when set', () => {
      process.env.AWS_COMMIT_ID = 'aws-commit-xyz';
      expect(getGitCommit()).toBe('aws-commit-xyz');
    });

    it('returns CF_PAGES_COMMIT_SHA when set', () => {
      process.env.CF_PAGES_COMMIT_SHA = 'cf-sha-456';
      expect(getGitCommit()).toBe('cf-sha-456');
    });

    it('returns RENDER_GIT_COMMIT when set', () => {
      process.env.RENDER_GIT_COMMIT = 'render-commit';
      expect(getGitCommit()).toBe('render-commit');
    });

    it('returns RAILWAY_GIT_COMMIT_SHA when set', () => {
      process.env.RAILWAY_GIT_COMMIT_SHA = 'railway-sha';
      expect(getGitCommit()).toBe('railway-sha');
    });

    it('returns GITHUB_SHA when set', () => {
      process.env.GITHUB_SHA = 'gh-sha-789';
      expect(getGitCommit()).toBe('gh-sha-789');
    });

    it('returns HEROKU_SLUG_COMMIT when set', () => {
      process.env.HEROKU_SLUG_COMMIT = 'heroku-slug';
      expect(getGitCommit()).toBe('heroku-slug');
    });

    it('respects priority order', () => {
      process.env.GITHUB_SHA = 'github-sha';
      process.env.HEROKU_SLUG_COMMIT = 'heroku-sha';
      expect(getGitCommit()).toBe('github-sha');
    });
  });

  describe('getDeploymentInfo', () => {
    it('returns default values when no env vars set', () => {
      const info = getDeploymentInfo();
      expect(info).toEqual({
        branch: 'main',
        commit: '',
        environment: 'development',
      });
    });

    it('returns correct values from Vercel env vars', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'feature/test';
      process.env.VERCEL_GIT_COMMIT_SHA = 'abc123';
      process.env.VERCEL_ENV = 'production';

      const info = getDeploymentInfo();
      expect(info).toEqual({
        branch: 'feature/test',
        commit: 'abc123',
        environment: 'production',
      });
    });

    it('returns correct values from Netlify env vars', () => {
      process.env.BRANCH = 'deploy-preview';
      process.env.COMMIT_REF = 'def456';
      process.env.CONTEXT = 'deploy-preview';

      const info = getDeploymentInfo();
      expect(info).toEqual({
        branch: 'deploy-preview',
        commit: 'def456',
        environment: 'deploy-preview',
      });
    });

    it('returns correct values from Railway env vars', () => {
      process.env.RAILWAY_GIT_BRANCH = 'main';
      process.env.RAILWAY_GIT_COMMIT_SHA = 'railway123';
      process.env.RAILWAY_ENVIRONMENT = 'production';

      const info = getDeploymentInfo();
      expect(info).toEqual({
        branch: 'main',
        commit: 'railway123',
        environment: 'production',
      });
    });

    it('falls back to NODE_ENV for environment', () => {
      process.env.NODE_ENV = 'test';

      const info = getDeploymentInfo();
      expect(info.environment).toBe('test');
    });

    it('handles mixed provider env vars', () => {
      process.env.VERCEL_GIT_COMMIT_REF = 'vercel-branch';
      process.env.GITHUB_SHA = 'github-sha';
      process.env.RAILWAY_ENVIRONMENT = 'staging';

      const info = getDeploymentInfo();
      expect(info).toEqual({
        branch: 'vercel-branch',
        commit: 'github-sha',
        environment: 'staging',
      });
    });
  });
});
