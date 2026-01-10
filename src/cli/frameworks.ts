import fs from 'fs-extra';
import path from 'path';
import {
  type Framework,
  type BackendFramework,
  type DeploymentMode,
  FRAMEWORK_CONFIGS,
  BACKEND_CONFIGS,
  FULLSTACK_FRAMEWORKS,
} from './types';

export async function detectFramework(cwd: string): Promise<Framework | null> {
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) return null;

    const pkg = await fs.readJson(packageJsonPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps['next']) {
      if (await fs.pathExists(path.join(cwd, 'app')) ||
          await fs.pathExists(path.join(cwd, 'src', 'app'))) {
        return 'nextjs-app';
      }
      return 'nextjs-pages';
    }

    if (deps['@sveltejs/kit']) {
      return 'sveltekit';
    }

    if (deps['vite'] && deps['vue']) {
      return 'vite-vue';
    }

    if (deps['vite'] && (deps['react'] || deps['@vitejs/plugin-react'])) {
      return 'vite-react';
    }

    if (deps['react']) {
      return 'vite-react';
    }

    if (deps['vue']) {
      return 'vite-vue';
    }

    return 'vanilla';
  } catch {
    return null;
  }
}

export function isFullstackFramework(framework: Framework): boolean {
  return FULLSTACK_FRAMEWORKS.includes(framework);
}

export async function detectBackendFramework(cwd: string, frontendFramework: Framework | null): Promise<BackendFramework | null> {
  try {
    const packageJsonPath = path.join(cwd, 'package.json');
    if (!(await fs.pathExists(packageJsonPath))) return null;

    const pkg = await fs.readJson(packageJsonPath);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (frontendFramework && isFullstackFramework(frontendFramework)) {
      if (frontendFramework === 'nextjs-app') return 'nextjs-app';
      if (frontendFramework === 'nextjs-pages') return 'nextjs-pages';
      if (frontendFramework === 'sveltekit') return 'sveltekit';
    }

    if (deps['hono']) return 'hono';
    if (deps['fastify']) return 'fastify';
    if (deps['koa']) return 'koa';
    if (deps['express']) return 'express';

    return null;
  } catch {
    return null;
  }
}

export function getHostedWidgetExample(framework: Framework, owner: string, repo: string): string {
  switch (framework) {
    case 'nextjs-app':
      return `import { InnerLensWidget } from 'inner-lens/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <InnerLensWidget repository="${owner}/${repo}" />
      </body>
    </html>
  );
}`;
    case 'nextjs-pages':
      return `import { InnerLensWidget } from 'inner-lens/react';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <InnerLensWidget repository="${owner}/${repo}" />
    </>
  );
}`;
    case 'vite-react':
      return `import { InnerLensWidget } from 'inner-lens/react';

function App() {
  return (
    <div>
      {/* Your app content */}
      <InnerLensWidget repository="${owner}/${repo}" />
    </div>
  );
}`;
    case 'vite-vue':
      return `<script setup>
import { InnerLensWidget } from 'inner-lens/vue';
</script>

<template>
  <div>
    <!-- Your app content -->
    <InnerLensWidget :repository="'${owner}/${repo}'" />
  </div>
</template>`;
    case 'sveltekit':
      return `<script>
  import { onMount } from 'svelte';
  import { InnerLensCore } from 'inner-lens';

  onMount(() => {
    const lens = new InnerLensCore({
      repository: '${owner}/${repo}',
    });
    lens.mount();
    return () => lens.unmount();
  });
</script>

<slot />`;
    case 'vanilla':
    default:
      return `<script type="module">
  import { InnerLens } from 'inner-lens/vanilla';

  const widget = new InnerLens({
    repository: '${owner}/${repo}',
  });
  widget.mount();
</script>`;
  }
}

export function generateWidgetFileContent(
  framework: Framework,
  existingContent: string | null,
  mode: DeploymentMode = 'self-hosted',
  hostedConfig?: { owner: string; repo: string }
): string {
  const config = FRAMEWORK_CONFIGS[framework];

  if (mode === 'hosted' && hostedConfig) {
    return getHostedWidgetExample(framework, hostedConfig.owner, hostedConfig.repo);
  }

  if (!existingContent) {
    return config.example;
  }

  if (framework === 'nextjs-app' || framework === 'nextjs-pages' || framework === 'vite-react') {
    if (existingContent.includes('InnerLensWidget')) {
      return existingContent;
    }

    const importStatement = `import { InnerLensWidget } from 'inner-lens/react';\n`;
    let newContent = existingContent;

    const lastImportIndex = existingContent.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const lineEnd = existingContent.indexOf('\n', lastImportIndex);
      newContent = existingContent.slice(0, lineEnd + 1) + importStatement + existingContent.slice(lineEnd + 1);
    } else {
      newContent = importStatement + existingContent;
    }

    if (framework === 'nextjs-app') {
      newContent = newContent.replace(
        /(\s*)({\s*children\s*})/g,
        '$1$2$1<InnerLensWidget />'
      );
    } else {
      newContent = newContent.replace(
        /(<\/[a-zA-Z]+>)(\s*\)?\s*;?\s*}\s*$)/,
        '<InnerLensWidget />\n        $1$2'
      );
    }

    return newContent;
  }

  if (framework === 'vite-vue') {
    if (existingContent.includes('InnerLensWidget')) {
      return existingContent;
    }

    let newContent = existingContent;
    if (existingContent.includes('<script setup>')) {
      newContent = newContent.replace(
        '<script setup>',
        `<script setup>\nimport { InnerLensWidget } from 'inner-lens/vue';`
      );
    } else if (existingContent.includes('<script setup lang="ts">')) {
      newContent = newContent.replace(
        '<script setup lang="ts">',
        `<script setup lang="ts">\nimport { InnerLensWidget } from 'inner-lens/vue';`
      );
    }

    newContent = newContent.replace(
      '</template>',
      '  <InnerLensWidget />\n</template>'
    );

    return newContent;
  }

  if (framework === 'sveltekit') {
    if (existingContent.includes('InnerLensCore')) {
      return existingContent;
    }

    const svelteScript = `<script>
  import { onMount } from 'svelte';
  import { InnerLensCore } from 'inner-lens';

  onMount(() => {
    const lens = new InnerLensCore();
    lens.mount();
    return () => lens.unmount();
  });
</script>

`;
    return svelteScript + existingContent;
  }

  return existingContent;
}

export async function findWidgetFilePath(cwd: string, framework: Framework): Promise<string> {
  const config = FRAMEWORK_CONFIGS[framework];
  const defaultPath = config.widgetFile;

  if (await fs.pathExists(path.join(cwd, defaultPath))) {
    return defaultPath;
  }

  if (framework === 'nextjs-app') {
    const srcPath = `src/${defaultPath}`;
    if (await fs.pathExists(path.join(cwd, srcPath))) {
      return srcPath;
    }
    const jsPath = defaultPath.replace('.tsx', '.js');
    if (await fs.pathExists(path.join(cwd, jsPath))) {
      return jsPath;
    }
    const srcJsPath = `src/${jsPath}`;
    if (await fs.pathExists(path.join(cwd, srcJsPath))) {
      return srcJsPath;
    }
  }

  if (framework === 'nextjs-pages') {
    const srcPath = `src/${defaultPath}`;
    if (await fs.pathExists(path.join(cwd, srcPath))) {
      return srcPath;
    }
  }

  return defaultPath;
}

export async function findApiRoutePath(cwd: string, backend: BackendFramework): Promise<string> {
  const config = BACKEND_CONFIGS[backend];
  const defaultPath = config.apiRouteFile;

  if (backend === 'nextjs-app') {
    const srcPath = `src/${defaultPath}`;
    const srcAppDir = path.join(cwd, 'src', 'app');
    if (await fs.pathExists(srcAppDir)) {
      return srcPath;
    }
  }

  if (backend === 'nextjs-pages') {
    const srcPath = `src/${defaultPath}`;
    const srcPagesDir = path.join(cwd, 'src', 'pages');
    if (await fs.pathExists(srcPagesDir)) {
      return srcPath;
    }
  }

  if (backend === 'sveltekit') {
    return defaultPath;
  }

  if (['express', 'fastify', 'hono', 'node'].includes(backend)) {
    const serverDir = path.join(cwd, 'server');
    if (await fs.pathExists(serverDir)) {
      return defaultPath.replace('src/', 'server/');
    }
  }

  return defaultPath;
}
