/* eslint-disable no-undefined */
import jmespath from 'jmespath';
import idempotenderCore, { Execution } from 'idempotender-core';
import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { IdempotenderMiddyConfig } from './types/IdempotenderMiddyConfig';

const jmespathMapper = (query: string) => {
  return (input: any): string => {
    return jmespath.search(input, query);
  };
};

const middleware = (config: IdempotenderMiddyConfig):
    middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {

  if (!config.keyMapper && !config.keyJmespath?.trim()) {
    throw new Error(
      "Config: Either 'keyJmespath' or a custom 'keyMapper' function is required in configuration object",
    );
  }
  if (config.keyMapper && config.keyJmespath) {
    throw new Error(
      "Config: If 'keyMapper' is defined, 'keyJmespath' shouldn't be defined because it won't have an effect",
    );
  }
  if (config.keyJmespath) {
    config.keyMapper = jmespathMapper(config.keyJmespath);
  }

  const idemCore = idempotenderCore(config);

  const before: middy.MiddlewareFn = async (request): Promise<any> => {
    if (!config.keyMapper) {
      throw new Error('keyMapper shouldnt be null');
    }

    const ckey = config.keyMapper(request.event);

    if (!ckey || typeof ckey !== 'string' || ckey.length <= 4) {
      throw new Error(`The key used for idempotency must be a string with len>4. key=${ckey}`);
    }

    // prefix key with lambda id from arn to reduce even more the chance of collision
    const lambdaPrefix = request.context.invokedFunctionArn.split(':')[4];
    const key = `${lambdaPrefix}:${ckey}`;

    // get execution
    const execution = await idemCore.getExecution(key);

    // check if it was completed, what means it was already run before and
    // we already have the previous results of this execution
    if (execution.statusCompleted()) {
      const previousOut = execution.output();
      if (previousOut) {
        const pout = JSON.parse(previousOut);
        // it should return immediatelly to avoid other transformations
        // for other middlewares to take place, because the output
        // was saved on the first call after other middlewares
        // already changed the response, so we shoudn't transform again now
        return Promise.resolve({ ...request.response, ...pout.data });
      }
      return Promise.resolve(null);
    }

    // even after waiting for some time, we couldn't get a lock, so we fail
    if (execution.statusLocked()) {
      throw new Error('Couldn\'t acquire idempotency lock for this request. Try again later.');
    }

    // sanity check
    if (!execution.statusOpen() && !execution.statusCompleted()) {
      throw new Error('Execution should be in status "open" or "locked"');
    }

    // store execution to use in a later phase
    request.internal = { ...request.internal, ...{ execution } };
    return Promise.resolve(undefined);
  };

  const after: middy.MiddlewareFn = async (request): Promise<any> => {
    const { execution } = request.internal;
    if (!execution) {
      throw new Error('request.internal.execution should be set');
    }
    const exec = <Execution>execution;

    // actual function was executed. save results
    if (exec.statusOpen()) {
      // wrap response so it can support null values
      const output = {
        data: request.response,
      };
      // store response for future calls to the same key
      const outputstr = JSON.stringify(output);
      await exec.complete(outputstr);
      return Promise.resolve(undefined);
    }

    // sanity check
    if (!exec.statusCompleted() && !exec.statusLocked()) {
      throw new Error('Status should be either "complemented" or "locked"');
    }

    return Promise.resolve(undefined);
  };

  const onError: middy.MiddlewareFn = async (request): Promise<any> => {
    const { execution } = request.internal;
    if (!execution) {
      return null;
    }
    const exec = <Execution>execution;
    await exec.cancel();
    return Promise.resolve(undefined);
  };

  return {
    before,
    after,
    onError,
  };
};

export default middleware;
