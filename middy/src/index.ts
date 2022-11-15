/* eslint-disable no-undefined */
import jmespath from 'jmespath';
import idempotenderCore, { Execution } from '@idempotender/core';
import middy from '@middy/core';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { IdempotenderMiddyConfig } from './types/IdempotenderMiddyConfig';

const jmespathMapper = (query: string) => {
  return (input: any): string => {
    return jmespath.search(input, query);
  };
};

const isReqFromAPIGW = (request: any): boolean => {
  return request.event.httpMethod;
};

const middleware = (
  config: IdempotenderMiddyConfig,
): middy.MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
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

  if (typeof config.markIdempotentResponse === 'undefined') {
    config.markIdempotentResponse = true;
  }

  const idemCore = idempotenderCore<any>(config);

  const before: middy.MiddlewareFn = async (request): Promise<any> => {
    if (!config.keyMapper) {
      throw new Error('keyMapper shouldnt be null');
    }

    const akey = config.keyMapper(request.event);
    let ckey = akey;
    if (typeof akey !== 'string') {
      ckey = JSON.stringify(akey);
    }
    if (!ckey || typeof ckey !== 'string' || ckey.length <= 4) {
      throw new Error(`The key for idempotency returned by mapper must be a string with len>4. key='${ckey}'`);
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
      // it should return immediatelly to avoid other transformations
      // for other middlewares to take place, because the output
      // was saved after other middlewares
      // already changed the response, so we shoudn't transform again now
      let aresp = {
        ...request.response,
        ...previousOut.data,
      };

      if (config.markIdempotentResponse) {
        // add response attribute with timestamp the first call was made
        aresp = {
          ...aresp,
          ...{ idempotencyTime: previousOut.ts },
        };

        // add X-Idempotency-From header if Lambda call came from HTTP call
        if (isReqFromAPIGW(request)) {
          if (!aresp.headers) {
            aresp = { ...aresp, headers: {} };
          }
          aresp.headers = {
            ...aresp.headers,
            ...{ 'X-Idempotency-From': new Date(previousOut.ts).toISOString() },
          };
        }
      }

      return Promise.resolve(aresp);
    }

    // even after waiting for some time, we couldn't get a lock, so we fail
    if (execution.statusLocked()) {
      throw new Error("Couldn't acquire idempotency lock for this request. Try again later.");
    }

    // sanity check
    if (!execution.statusOpen() && !execution.statusCompleted()) {
      throw new Error('Execution should be in status "open" or "locked"');
    }

    // store execution to use in a later phase
    request.internal = { ...request.internal, ...{ execution } };
    return Promise.resolve(undefined);
  };

  const onError: middy.MiddlewareFn = async (request): Promise<any> => {
    const { execution } = request.internal;
    if (!execution) {
      return Promise.resolve(undefined);
    }
    const exec = <Execution<any>>execution;
    await exec.cancel();
    return Promise.resolve(undefined);
  };

  const after: middy.MiddlewareFn = async (request): Promise<any> => {
    const { execution } = request.internal;
    if (!execution) {
      throw new Error('request.internal.execution should be set');
    }
    const exec = <Execution<any>>execution;

    // actual function was executed
    if (exec.statusOpen()) {
      // validate response
      let { validResponseJmespath } = config;
      if (typeof validResponseJmespath === 'undefined' && isReqFromAPIGW(request)) {
        validResponseJmespath = 'statusCode >= `200` && statusCode < `300`';
      }

      if (validResponseJmespath) {
        let resp = request.response;
        if (typeof resp === 'string') {
          try {
            resp = JSON.parse(request.response);
          } catch (err) {
            // not a valid json. skip checks
          }
        }
        if (typeof resp !== 'object') {
          resp = null;
        }

        // only check if response is a json, else, ignore checks
        if (resp) {
          const valid = jmespath.search(resp, validResponseJmespath);
          if (typeof valid !== 'boolean') {
            await exec.cancel();
            throw new Error(
              "'config.validResponseJmespath' should evaluate to a boolean expression",
            );
          }
          if (!valid) {
            await exec.cancel();
            return Promise.resolve(undefined);
          }
        }
      }

      // store response for future calls to the same key
      await exec.complete(request.response);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(undefined);
  };

  return {
    before,
    after,
    onError,
  };
};

export default middleware;
