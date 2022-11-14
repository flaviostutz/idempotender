/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable import/no-commonjs */
const eslintConfig = require('../../shared/js/lint/eslint-config');

module.exports = { ...eslintConfig, ...{
  parserOptions: {
    // needed by some typescript rules
    project: ["./tsconfig.eslint.json"],
    tsconfigRootDir: __dirname,
  }},
  extends: '@stutzlab/eslint-config',
};
