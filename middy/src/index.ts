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

  const before: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> =
    async (request): Promise<any> => {
      if (!config.keyMapper) {
        throw new Error('keyMapper shouldnt be null');
      }

      const key = config.keyMapper(request.event);

      // get execution
      const execution = await idemCore.getExecution(key);

      // check if it was completed, what means it was already run before and
      // we already have the previous results of this execution
      if (execution.statusCompleted()) {
        return execution.output();
      }

      // even after waiting for some time, we couldn't get a lock, so we fail
      if (execution.statusLocked()) {
        console.warn(`Timeout getting idempotency lock for key ${key}`);
        return {
          statusCode: 409,
          body: JSON.stringify('Couldn\'t acquire idempotency lock for this request. Try again later.'),
        };
      }

      if (!execution.statusOpen()) {
        throw new Error('Execution should be in status "open"');
      }

      // store execution to use in a later phase
      request.internal = { ...request.internal, ...{ execution } };
      return null;
    };

  const after: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> =
    async (request): Promise<any> => {
      const { execution } = request.internal;
      if (!execution) {
        throw new Error('request.internal.execution should be set');
      }
      const exec = <Execution>execution;

      // actual function was executed
      // store response for future calls to the same key
      let output = '';
      if (request.response) {
        const resp = {
          // will work with json parsed or non parsed body
          body: request.response.body,
          headers: request.response.headers,
          statusCode: request.response.statusCode,
        };
        output = JSON.stringify(resp);
      }
      await exec.complete(output);

      return null;
    };

  const onError: middy.MiddlewareFn<APIGatewayProxyEvent, APIGatewayProxyResult> =
    async (request): Promise<any> => {
      const { execution } = request.internal;
      if (!execution) {
        return null;
      }
      const exec = <Execution>execution;
      await exec.cancel();
      return null;
    };

  return {
    before,
    after,
    onError,
  };
};

export default middleware;
