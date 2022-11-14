// needed by local dynamodb
process.env.AWS_ACCESS_KEY_ID = 'DUMMY';
process.env.AWS_SECRET_ACCESS_KEY = 'DUMMY';

// eslint-disable-next-line import/no-commonjs
module.exports = {
  preset: 'jest-dynalite',
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(tsx?|json?)$': [
      'esbuild-jest',
      {
        sourcemap: true, // correct line numbers in code coverage
      },
    ],
  },
  collectCoverage: false,
  collectCoverageFrom: ['./src/**'],
  coverageThreshold: {
    global: {
      lines: 50,
      branches: 50,
      functions: 50,
    },
  },
};
