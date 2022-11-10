/* eslint-disable @typescript-eslint/no-empty-function */

import middy from '@middy/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import idempotender, { setDynamoDBClient } from 'idempotender-core';

import { awsContext } from './__mock__/awsContext';
// import { awsAPIProxyRequest } from './__mock__/awsRequest';

import idempotenderMiddy from './index';

// const sleep = async (ms: number): Promise<void> => {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// };

describe('When using default configurations', () => {
  beforeAll(async () => {
    const ddbclient = new DynamoDBClient({
      endpoint: 'http://localhost:8000',
      region: 'local-env',
      credentials: {
        accessKeyId: 'dummyAccessKey',
        secretAccessKey: 'dummySecretKey',
      },
    });
    setDynamoDBClient(ddbclient);
    const prefix = awsContext().invokedFunctionArn.split(':')[4];
    const idem = idempotender({});
    const exec1 = await idem.getExecution(`${prefix}:mykey111`);
    await exec1.cancel();
    const exec2 = await idem.getExecution(`${prefix}:mykey222`);
    await exec2.cancel();
    const exec3 = await idem.getExecution(`${prefix}:mykey333`);
    await exec3.cancel();
    const exec4 = await idem.getExecution(`${prefix}:mykey444`);
    await exec4.cancel();
    const exec5 = await idem.getExecution(`${prefix}:mykey555`);
    await exec5.cancel();
    const exec6 = await idem.getExecution(`${prefix}:mykey666`);
    await exec6.cancel();
  });

  it('Jmespath expression should be required', async () => {
    const test = ():any => idempotenderMiddy({});
    expect(test).toThrowError();
  });

  it('Custom key mapper should be supported', async () => {
    const test = ():any => idempotenderMiddy({ keyMapper: (mm) => mm });
    expect(test).not.toThrowError();
  });

  it('Should fail if a valid key cannot be extracted', async () => {
    let errorThrown = false;
    const handler = middy(() => {});
    handler
      .use(idempotenderMiddy({ keyJmespath: 'param1' }))
      .onError(() => {
        errorThrown = true;
      });
    const event = {};
    await handler(event, awsContext());
    expect(errorThrown).toBeTruthy();
  });

  it('Should succeed if key can be extracted', async () => {
    const handler = middy(() => {});
    handler
      .use(idempotenderMiddy({ keyJmespath: 'param1' }))
      .onError((request) => { throw new Error(request.error?.message); });
    const event = { param1: 'valid key here!' };
    await handler(event, awsContext());
  });

  it('Single call with idempotency control should work', async () => {
    let runCount = 0;
    const handler = middy(async (request:any) => {
      runCount += 1;
      return {
        message: request.param2,
        on: new Date().getTime(),
      };
    });
    handler
      .use(idempotenderMiddy({ keyJmespath: 'param1' }))
      .onError((request) => { throw new Error(request.error?.message); });

    const event = { param1: 'mykey111', param2: 'something else' };
    const resp = await handler(event, awsContext());
    expect(resp).toBeDefined();
    expect(resp.message).toEqual(event.param2);
    expect(runCount).toEqual(1);
  });

  it('Multiple calls with the same input should return same result without running twice', async () => {
    let runCount = 0;
    const handler = middy(async (request:any) => {
      runCount += 1;
      return {
        message: request.param2,
        on: new Date().getTime(),
      };
    });
    handler
      .use(idempotenderMiddy({ keyJmespath: 'param1' }))
      .onError((request) => { throw new Error(request.error?.message); });

    const event = { param1: 'mykey222', param2: 'something else' };

    const resp1 = await handler(event, awsContext());
    expect(runCount).toEqual(1);
    expect(resp1).toBeDefined();
    expect(resp1.message).toEqual(event.param2);

    const resp2 = await handler(event, awsContext());
    expect(runCount).toEqual(1);
    expect(resp2).toBeDefined();
    expect(resp2.message).toEqual(event.param2);
    expect(resp2.on).toBeGreaterThan(100);

    const resp3 = await handler(event, awsContext());
    expect(runCount).toEqual(1);
    expect(resp3.message).toEqual(event.param2);
  });

  it('Multiple concurrent calls gets locks, completes and resolve successfully', async () => {
    let runCount = 0;
    let runAfterCount = 0;
    let runBeforeCount = 0;
    const handler = middy(async (request:any) => {
      runCount += 1;
      // await sleep(30); // will force parallelism but it's not working - making jest hang
      return {
        message: request.param2,
        on: new Date().getTime(),
      };
    });
    handler
      .before(() => {
        runBeforeCount += 1;
      })
      .use(idempotenderMiddy({
        keyJmespath: 'param1',
        lockAcquireTimeout: 600,
        lockTTL: 700,
        executionTTL: 1200,
      }))
      .after(() => {
        runAfterCount += 1;
      })
      .onError((request) => { throw new Error(request.error?.message); });

    const handlerPromises = [];
    const event = { param1: 'mykey333', param2: 'something else' };
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event, awsContext()));
    }
    const event2 = { param1: 'mykey444', param2: 'something else' };
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event2, awsContext()));
    }
    const event3 = { param1: 'mykey555', param2: 'something else' };
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event3, awsContext()));
    }
    const event4 = { param1: 'mykey666', param2: 'something else' };
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event4, awsContext()));
    }

    // force all to run in parallel
    const res = await Promise.all(handlerPromises);
    expect(runBeforeCount).toEqual(120);
    expect(runCount).toEqual(4);
    expect(runAfterCount).toEqual(4);

    // count the number of different responses
    const keys = new Map<number, boolean>();
    const respCount = res.reduce((count, elem) => {
      if (!keys.get(elem.on)) {
        keys.set(elem.on, true);
        return count + 1;
      }
      return count;
    }, 0);
    expect(respCount).toEqual(4);
  });

});

