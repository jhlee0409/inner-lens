import { defineConfig } from 'tsup';

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
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
    target: 'es2022',
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
            fs.writeFileSync(filePath, `"use client";\n${content}`);
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
    external: ['vue'],
    treeshake: true,
    minify: false,
    target: 'es2022',
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
  },
  // Session Replay build (optional, large bundle)
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
    external: [], // Bundle rrweb for standalone use
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
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension: () => ({ js: '.cjs' }),
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
    banner: {
      js: '#!/usr/bin/env node',
    },
    outExtension: () => ({ js: '.cjs' }),
  },
]);
