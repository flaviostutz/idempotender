import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { core } from './core';
import { ExecutionOutput } from './types/ExecutionOutput';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { IdempotentFunc } from './types/IdempotentFunc';

async function withIdempotency<T>(
  func: IdempotentFunc<T>,
  key: string,
  config: IdempotenderConfig = {
    dynamoDBClient: new DynamoDBClient({}),
  },
): Promise<ExecutionOutput<T>> {
  const ccore = core<T>(config);
  const execution = await ccore.getExecution(key);

  if (execution.statusCompleted()) {
    return execution.output();
  }

  if (execution.statusOpen()) {
    try {
      const result = func();
      const output = await execution.complete(result);
      return output;
    } catch (err) {
      await execution.cancel();
      throw err;
    }
  }

  throw new Error(`Couldn't acquire lock key='${key}'`);
}

export { withIdempotency };
