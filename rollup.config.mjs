import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/plugin.ts",
  output: {
    file: "dist/plugin.js",
    format: "cjs",
    sourcemap: false
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    json(),
    terser()
  ],
  external: [
    "ws",
    /^node:/
  ]
};
