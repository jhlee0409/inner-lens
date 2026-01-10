import { defineConfig } from 'tsup';
import fs from 'fs';
import { execSync } from 'child_process';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return process.env.GIT_COMMIT || '';
  }
}

const runtimeDefines = {
  __INNER_LENS_VERSION__: JSON.stringify(pkg.version),
  __INNER_LENS_COMMIT__: JSON.stringify(process.env.GIT_COMMIT || getGitCommit()),
  __INNER_LENS_RELEASE__: JSON.stringify(process.env.GIT_RELEASE || `v${pkg.version}`),
  __INNER_LENS_BUILD_TIME__: JSON.stringify(process.env.BUILD_TIME || new Date().toISOString()),
};

export default defineConfig([
  // Core library build (framework-agnostic)
  {
    entry: {
      core: 'src/core.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    treeshake: true,
    minify: false,
    target: 'es2022',
    external: ['rrweb', '@rrweb/types'],
    define: runtimeDefines,
  },
  // React library build (with "use client" directive for Next.js RSC compatibility)
  {
    entry: {
      react: 'src/react.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ['react', 'react-dom', 'rrweb', '@rrweb/types'],
    treeshake: true,
    minify: false,
    target: 'es2022',
    define: runtimeDefines,
    esbuildOptions(options) {
      options.banner = {
        js: '"use client";\n',
      };
    },
    async onSuccess() {
      // Prepend "use client" if esbuild banner didn't apply (tsup multi-config issue)
      const fs = await import('fs');
      const path = await import('path');
      const files = ['dist/react.js', 'dist/react.cjs'];
      for (const file of files) {
        const filePath = path.resolve(file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          if (!content.startsWith('"use client"')) {
            fs.writeFileSync(filePath, '"use client";\n' + content);
          }
        }
      }
    },
  },
  // Vue library build
  {
    entry: {
      vue: 'src/vue.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    external: ['vue', 'rrweb', '@rrweb/types'],
    treeshake: true,
    minify: false,
    target: 'es2022',
    define: runtimeDefines,
  },
  // Vanilla JS build (no framework dependencies)
  {
    entry: {
      vanilla: 'src/vanilla.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'es2022',
    external: ['rrweb', '@rrweb/types'],
    define: runtimeDefines,
  },
  // Server library build
  {
    entry: {
      server: 'src/server.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'node18',
    noExternal: ['zod', '@octokit/rest'],
  },
  // Build utilities (for git branch injection)
  {
    entry: {
      build: 'src/build.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'node18',
  },
  // Session Replay build (uses user's rrweb)
  {
    entry: {
      replay: 'src/replay.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'es2022',
    external: ['rrweb', '@rrweb/types'],
    define: runtimeDefines,
  },
  // CLI executable build
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'node18',
    noExternal: [/.*/],
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension: () => ({ js: '.cjs' }),
    define: {
      __INNER_LENS_VERSION__: JSON.stringify(pkg.version),
    },
  },
  // create-inner-lens wrapper (for npx create-inner-lens)
  {
    entry: {
      create: 'src/create.ts',
    },
    format: ['cjs'],
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: false,
    treeshake: true,
    minify: false,
    target: 'node18',
    noExternal: [/.*/],
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension: () => ({ js: '.cjs' }),
  },
]);
