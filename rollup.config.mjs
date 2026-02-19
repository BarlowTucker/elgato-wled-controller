import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";

export default {
  input: "src/plugin.ts",
  output: {
    file: "dist/plugin.js",
    format: "es",
    sourcemap: true
  },
  plugins: [
    resolve({ preferBuiltins: true }),
    typescript({ tsconfig: "./tsconfig.json" }),
    json()
  ],
  external: []
};
