import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const external = [
  'dgram',
  'os',
  'dns',
  'net',
  'crypto',
  'path',
  'fs',
  'http',
  'https',
  'url',
  'stream',
  'events',
  'buffer',
  'util',
  'tls',
  'zlib',
  'querystring',
  'child_process',
  'worker_threads',
  'perf_hooks',
  'readline',
  'assert',
  'constants',
  'module',
  'vm',
  'v8',
  'cluster',
];

export default {
  input: 'src/plugin.ts',
  output: {
    file: 'bin/plugin.js',
    format: 'cjs',
    sourcemap: false,
    exports: 'auto',
  },
  external,
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
  ],
};
