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
  // React library build (with "use client" directive)
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
    banner: {
      js: '"use client";',
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
  // CLI executable build
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['esm'],
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
    noExternal: ['chalk', 'commander', 'fs-extra', 'inquirer'],
  },
]);
