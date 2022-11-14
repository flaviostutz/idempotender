// eslint-disable-next-line import/no-commonjs
module.exports = {
  testMatch: ['**/?(*.)+(int).+(ts|tsx|js)'],
  transform: {
    '^.+\\.tsx?$': [
      'esbuild-jest',
    ],
  },
};
