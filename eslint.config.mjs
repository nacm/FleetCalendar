import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["out/**", "generated/**", "obj/**", "node_modules/**"] },
  ...tseslint.configs.recommended
);
