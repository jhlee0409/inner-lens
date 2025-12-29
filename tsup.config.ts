import { defineConfig } from 'tsup';

export default defineConfig([
  // Client library build (with "use client" directive)
  {
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    treeshake: true,
    minify: false,
    target: 'es2022',
    banner: {
      js: '"use client";',
    },
  },
  // Server library build (no "use client")
  {
    entry: {
      server: 'src/server.ts',
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
    target: 'node20',
    banner: {
      js: '#!/usr/bin/env node',
    },
    noExternal: ['chalk', 'commander', 'fs-extra', 'inquirer'],
  },
]);
