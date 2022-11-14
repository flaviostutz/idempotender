import { handler } from './handler';

// Trick to make OTEL layer work
// https://github.com/evanw/esbuild/issues/2199
// https://github.com/evanw/esbuild/issues/1079
// eslint-disable-next-line import/no-commonjs
module.exports = {
  handler,
};

// export {handler} from './handler';
