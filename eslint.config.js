/**
 * ESLint flat config for State of Britain.
 * Targets browser-based D3 / vanilla JS code.
 */
export default [
  {
    files: ["shared/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        IntersectionObserver: "readonly",
        d3: "readonly",
        // updateChart is defined per-page in inline script
        updateChart: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error",
      "no-redeclare": "off",       // globals intentionally declared via var in script tags
      "eqeqeq": ["error", "always"],
      "no-implicit-globals": "off", // shared utils must be global for script-tag loading
      "no-var": "off",
      "prefer-const": "off",
      "no-console": "warn",
      "curly": ["warn", "multi-line"],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        __dirname: "readonly",
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off",
    },
  },
];
