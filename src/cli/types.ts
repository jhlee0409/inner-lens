/**
 * CLI Type Definitions and Configuration Constants
 * 
 * 타입 정의와 프레임워크/프로바이더 설정을 중앙 관리합니다.
 */

// GitHub OAuth App Client ID for inner-lens
export const GITHUB_CLIENT_ID = 'Ov23li3zMscAsVeYVXt5';
export const GITHUB_APP_URL = 'https://github.com/apps/inner-lens-app';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface AccessTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface InitOptions {
  eject?: boolean;
  provider?: 'anthropic' | 'openai' | 'google';
  yes?: boolean;
}

export type AIProvider = 'anthropic' | 'openai' | 'google';
export type Framework = 'nextjs-app' | 'nextjs-pages' | 'vite-react' | 'vite-vue' | 'sveltekit' | 'vanilla';
export type BackendFramework = 'nextjs-app' | 'nextjs-pages' | 'sveltekit' | 'express' | 'fastify' | 'hono' | 'node' | 'koa';
export type DeploymentMode = 'hosted' | 'self-hosted';

export interface ProviderConfig {
  name: string;
  defaultModel: string;
  modelSuggestions: string[];
  secretName: string;
  envVar: string;
}

export interface BackendConfig {
  name: string;
  apiRouteFile: string;
  apiRouteTemplate: string;
}

export interface FrameworkConfig {
  name: string;
  importPath: string;
  widgetFile: string;
  example: string;
}

// ============================================================================
// Provider Configurations
// ============================================================================

export const PROVIDER_CONFIGS: Record<AIProvider, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic (Claude)',
    defaultModel: 'claude-sonnet-4-5-20250929',
    modelSuggestions: [
      'claude-sonnet-4-5-20250929',
      'claude-opus-4-5-20251124',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
    ],
    secretName: 'ANTHROPIC_API_KEY',
    envVar: 'ANTHROPIC_API_KEY',
  },
  openai: {
    name: 'OpenAI (GPT)',
    defaultModel: 'gpt-5.2',
    modelSuggestions: [
      'gpt-5.2',
      'gpt-5.2-pro',
      'gpt-5',
      'gpt-5-mini',
      'gpt-5-nano',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'o3',
      'o3-mini',
      'o4-mini',
    ],
    secretName: 'OPENAI_API_KEY',
    envVar: 'OPENAI_API_KEY',
  },
  google: {
    name: 'Google (Gemini)',
    defaultModel: 'gemini-2.5-flash',
    modelSuggestions: [
      'gemini-3-pro',
      'gemini-3-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
    ],
    secretName: 'GOOGLE_GENERATIVE_AI_API_KEY',
    envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
};

// ============================================================================
// Framework Configurations
// ============================================================================

export const FRAMEWORK_CONFIGS: Record<Framework, FrameworkConfig> = {
  'nextjs-app': {
    name: 'Next.js (App Router)',
    importPath: 'inner-lens/react',
    widgetFile: 'app/layout.tsx',
    example: `import { InnerLensWidget } from 'inner-lens/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <InnerLensWidget />
      </body>
    </html>
  );
}`,
  },
  'nextjs-pages': {
    name: 'Next.js (Pages Router)',
    importPath: 'inner-lens/react',
    widgetFile: 'pages/_app.tsx',
    example: `import { InnerLensWidget } from 'inner-lens/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <InnerLensWidget />
    </>
  );
}`,
  },
  'vite-react': {
    name: 'Vite + React',
    importPath: 'inner-lens/react',
    widgetFile: 'src/App.tsx',
    example: `import { InnerLensWidget } from 'inner-lens/react';

function App() {
  return (
    <div>
      {/* Your app content */}
      <InnerLensWidget />
    </div>
  );
}`,
  },
  'vite-vue': {
    name: 'Vite + Vue',
    importPath: 'inner-lens/vue',
    widgetFile: 'src/App.vue',
    example: `<script setup>
import { InnerLensWidget } from 'inner-lens/vue';
</script>

<template>
  <div>
    <!-- Your app content -->
    <InnerLensWidget />
  </div>
</template>`,
  },
  'sveltekit': {
    name: 'SvelteKit',
    importPath: 'inner-lens/vanilla',
    widgetFile: 'src/routes/+layout.svelte',
    example: `<script>
  import { onMount } from 'svelte';
  import { InnerLensCore } from 'inner-lens';

  onMount(() => {
    const lens = new InnerLensCore();
    lens.mount();
    return () => lens.unmount();
  });
</script>

<slot />`,
  },
  'vanilla': {
    name: 'Vanilla JS / Other',
    importPath: 'inner-lens/vanilla',
    widgetFile: 'index.html',
    example: `<script type="module">
  import 'inner-lens/vanilla';
  // Widget auto-initializes!
</script>`,
  },
};

// Fullstack frameworks that have built-in API routes
export const FULLSTACK_FRAMEWORKS: Framework[] = ['nextjs-app', 'nextjs-pages', 'sveltekit'];

// ============================================================================
// Backend Configurations
// ============================================================================

export const BACKEND_CONFIGS: Record<BackendFramework, BackendConfig> = {
  'nextjs-app': {
    name: 'Next.js App Router',
    apiRouteFile: 'app/api/inner-lens/report/route.ts',
    apiRouteTemplate: `import { createFetchHandler } from 'inner-lens/server';

const handler = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
  labels: ['inner-lens', 'bug'],
});

export const POST = handler;
`,
  },
  'nextjs-pages': {
    name: 'Next.js Pages Router',
    apiRouteFile: 'pages/api/inner-lens/report.ts',
    apiRouteTemplate: `import type { NextApiRequest, NextApiResponse } from 'next';
import { handleBugReport } from 'inner-lens/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result = await handleBugReport(req.body, {
    githubToken: process.env.GITHUB_TOKEN!,
    repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
    labels: ['inner-lens', 'bug'],
  });

  return res.status(result.status).json(result.body);
}
`,
  },
  'sveltekit': {
    name: 'SvelteKit',
    apiRouteFile: 'src/routes/api/inner-lens/report/+server.ts',
    apiRouteTemplate: `import { json } from '@sveltejs/kit';
import { GITHUB_TOKEN } from '$env/static/private';
import type { RequestHandler } from './$types';
import { handleBugReport } from 'inner-lens/server';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  const result = await handleBugReport(body, {
    githubToken: GITHUB_TOKEN,
    repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
    labels: ['inner-lens', 'bug'],
  });

  return json(result.body, { status: result.status });
};
`,
  },
  'express': {
    name: 'Express',
    apiRouteFile: 'src/routes/inner-lens.ts',
    apiRouteTemplate: `import { Router } from 'express';
import { createExpressHandler } from 'inner-lens/server';

const router = Router();

router.post('/inner-lens/report', createExpressHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
  labels: ['inner-lens', 'bug'],
}));

export default router;
`,
  },
  'fastify': {
    name: 'Fastify',
    apiRouteFile: 'src/routes/inner-lens.ts',
    apiRouteTemplate: `import { FastifyPluginAsync } from 'fastify';
import { createFastifyHandler } from 'inner-lens/server';

const innerLensRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/inner-lens/report', createFastifyHandler({
    githubToken: process.env.GITHUB_TOKEN!,
    repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
    labels: ['inner-lens', 'bug'],
  }));
};

export default innerLensRoutes;
`,
  },
  'hono': {
    name: 'Hono',
    apiRouteFile: 'src/routes/inner-lens.ts',
    apiRouteTemplate: `import { Hono } from 'hono';
import { createFetchHandler } from 'inner-lens/server';

const app = new Hono();

const handler = createFetchHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
  labels: ['inner-lens', 'bug'],
});

app.post('/inner-lens/report', (c) => handler(c.req.raw));

export default app;
`,
  },
  'node': {
    name: 'Node.js HTTP',
    apiRouteFile: 'src/inner-lens-handler.ts',
    apiRouteTemplate: `import { createNodeHandler } from 'inner-lens/server';

export const innerLensHandler = createNodeHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
  labels: ['inner-lens', 'bug'],
});

// Usage in your server:
// if (req.url === '/api/inner-lens/report' && req.method === 'POST') {
//   await innerLensHandler(req, res);
// }
`,
  },
  'koa': {
    name: 'Koa',
    apiRouteFile: 'src/routes/inner-lens.ts',
    apiRouteTemplate: `import Router from '@koa/router';
import { createKoaHandler } from 'inner-lens/server';

const router = new Router();

const handler = createKoaHandler({
  githubToken: process.env.GITHUB_TOKEN!,
  repository: process.env.GITHUB_REPOSITORY || 'owner/repo',
  labels: ['inner-lens', 'bug'],
});

router.post('/api/inner-lens/report', async (ctx) => {
  await handler(ctx);
});

export default router;
`,
  },
};
