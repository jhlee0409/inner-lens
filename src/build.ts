const BRANCH_ENV_VARS = [
  'VERCEL_GIT_COMMIT_REF',
  'BRANCH',
  'AWS_BRANCH',
  'CF_PAGES_BRANCH',
  'RENDER_GIT_BRANCH',
  'RAILWAY_GIT_BRANCH',
  'GITHUB_REF_NAME',
  'HEROKU_BRANCH',
] as const;

const COMMIT_ENV_VARS = [
  'VERCEL_GIT_COMMIT_SHA',
  'COMMIT_REF',
  'AWS_COMMIT_ID',
  'CF_PAGES_COMMIT_SHA',
  'RENDER_GIT_COMMIT',
  'RAILWAY_GIT_COMMIT_SHA',
  'GITHUB_SHA',
  'HEROKU_SLUG_COMMIT',
] as const;

const ENVIRONMENT_ENV_VARS = [
  'VERCEL_ENV',
  'CONTEXT',
  'RAILWAY_ENVIRONMENT',
  'NODE_ENV',
] as const;

function getFirstEnvValue(vars: readonly string[], fallback: string): string {
  for (const v of vars) {
    const value = process.env[v];
    if (value) return value;
  }
  return fallback;
}

export function getGitBranch(): string {
  return getFirstEnvValue(BRANCH_ENV_VARS, 'main');
}

export function getGitCommit(): string {
  return getFirstEnvValue(COMMIT_ENV_VARS, '');
}

export function getDeploymentInfo(): {
  branch: string;
  commit: string;
  environment: string;
} {
  return {
    branch: getGitBranch(),
    commit: getGitCommit(),
    environment: getFirstEnvValue(ENVIRONMENT_ENV_VARS, 'development'),
  };
}
