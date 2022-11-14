import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { withIdempotency } from './withIdempotency';
import { setDynamoDBClient } from './db';
import { core } from './core';

const ddbclient = new DynamoDBClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  region: 'local',
});
setDynamoDBClient(ddbclient);

describe('withIdempotency utility', () => {
  it('Multiple calls to same key should return cached value', async () => {
    const out1 = await withIdempotency((): string => {
      return `First run at ${new Date()}`;
    }, 'key1');

    const out2 = await withIdempotency((): string => {
      return `Second run at ${new Date()}`;
    }, 'key1');

    expect(out2).toStrictEqual(out1);
  });

  it('Exception is thrown if function throws an exception', async () => {
    const idemFunc = async (): Promise<void> => {
      await withIdempotency((): string => {
        throw new Error('WOW! Something happened!');
      }, 'key1');
    };
    await expect(idemFunc).rejects.toThrowError();
  });

  it('Lock is released immediatelly if function throws an exception', async () => {
    const config = {
      lockEnable: true,
      lockTTL: 2,
      executionTTL: 2.5,
      keyHash: true,
      lockAcquireTimeout: 0.3,
    };

    // call function
    const idemFunc = async (): Promise<void> => {
      await withIdempotency(
        (): string => {
          throw new Error('WOW! Something happened!');
        },
        'key1',
        config,
      );
    };

    await expect(idemFunc).rejects.toThrowError();

    // verify if lock was cancelled
    const idem = core<string>(config);
    const res2 = await idem.getExecution('key1');
    expect(res2.statusLocked()).toBeFalsy();
    expect(res2.statusOpen()).toBeTruthy();
    expect(res2.statusCompleted()).toBeFalsy();
  });
});

