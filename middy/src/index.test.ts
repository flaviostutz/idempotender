/* eslint-disable @typescript-eslint/no-empty-function */

import middy from '@middy/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import idempotender from '@idempotender/core';

import { awsContext } from './__mock__/awsContext';

import idempotenderMiddy from './index';

const testDynamoDBClient = new DynamoDBClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  region: 'local',
});

const prefix = awsContext().invokedFunctionArn.split(':')[4];
const idem = idempotender({
  lockAcquireTimeout: 1, lockTTL: 2,
  dynamoDBClient: testDynamoDBClient,
});

const randomInt = (): number => {
  return Math.floor(Math.random() * 999999);
};

describe('When using default configurations', () => {
  beforeAll(async () => {
    // await (await idem.getExecution(`${prefix}:mykey222`)).cancel();
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
    const exec7 = await idem.getExecution(`${prefix}:mykey777`);
    await exec7.cancel();
    const exec8 = await idem.getExecution(`${prefix}:mykey888`);
    await exec8.cancel();
    const exec9 = await idem.getExecution(`${prefix}:mykey999`);
    await exec9.cancel();
    const exec19 = await idem.getExecution(`${prefix}:mykey1999`);
    await exec19.cancel();
    const exec29 = await idem.getExecution(`${prefix}:mykey2999`);
    await exec29.cancel();
    const exec39 = await idem.getExecution(`${prefix}:mykey3999`);
    await exec39.cancel();
    const exec49 = await idem.getExecution(`${prefix}:mykey4999`);
    await exec49.cancel();
  });

  it('Jmespath expression should be required', async () => {
    const test = (): any => idempotenderMiddy({ dynamoDBClient: testDynamoDBClient });
    expect(test).toThrowError();
  });

  it('Custom key mapper should be supported', async () => {
    const test = (): any => idempotenderMiddy({ keyMapper: (mm) => mm, dynamoDBClient: testDynamoDBClient });
    expect(test).not.toThrowError();
  });

  it('Should fail if a valid key cannot be extracted', async () => {
    const handler = middy(() => {});
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));
    const event = {};

    const invokeHandler = async (): Promise<void> => {
      return handler(event, awsContext());
    };

    await expect(invokeHandler).rejects.toThrowError();
  });

  it('Should fail if extracted key is too short', async () => {
    const handler = middy(() => {});
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));
    const event = { param1: 'abc' };

    const invokeHandler = async (): Promise<void> => {
      return handler(event, awsContext());
    };

    await expect(invokeHandler).rejects.toThrowError();
  });


  it('Should succeed if key can be extracted', async () => {
    const handler = middy(() => {});
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));
    const event = { param1: 'valid key here!' };
    await handler(event, awsContext());
  });

  it('Single call with idempotency control should work', async () => {
    await cancelExec('mykey111');
    let runCount = 0;
    const handler = middy(async (request: any) => {
      runCount += 1;
      return {
        message: request.param2,
        on: randomInt(),
      };
    });
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));

    const event = { param1: 'mykey111', param2: 'something else' };
    const resp = await handler(event, awsContext());
    expect(resp).toBeDefined();
    expect(resp.message).toEqual(event.param2);
    expect(runCount).toEqual(1);
  });

  it('Dont save idempotency for invalid responses', async () => {
    await cancelExec('mykey999');
    const handler = middy(async (request: any) => {
      return {
        key: request.param2,
        on: randomInt(),
        status: 11111,
      };
    });

    handler.use(
      idempotenderMiddy({
        keyJmespath: 'param1',
        validResponseJmespath: 'on > `-1` && status == `22222`',
        dynamoDBClient: testDynamoDBClient,
      }),
    );

    const event = { param1: 'mykey999', param2: 'something else' };
    const resp: any = await handler(event, awsContext());
    expect(resp.idempotencyTime).not.toBeDefined();
    expect(resp.status).not.toBe(22222);

    const exec = await idem.getExecution(`${prefix}:mykey999`);
    expect(exec.statusOpen()).toBeTruthy();
  });

  it('Save idempotency for valid responses', async () => {
    await cancelExec('mykey1999');
    const handler = middy(async (request: any) => {
      return {
        key: request.param2,
        on: randomInt(),
        status: 22222,
      };
    });

    handler.use(
      idempotenderMiddy({
        keyJmespath: 'param1',
        validResponseJmespath: 'on > `-1` && status == `22222`',
        dynamoDBClient: testDynamoDBClient,
      }),
    );

    const event = { param1: 'mykey1999', param2: 'something else' };

    // first call
    const resp: any = await handler(event, awsContext());
    expect(resp.idempotencyTime).not.toBeDefined();
    expect(resp.key).toBe(event.param2);
    expect(resp.on).toBeGreaterThan(-1);
    expect(resp.status).toEqual(22222);
    const exec = await idem.getExecution(`${prefix}:mykey1999`);
    expect(exec.statusCompleted()).toBeTruthy();

    // second call
    const resp2: any = await handler(event, awsContext());
    expect(resp2.idempotencyTime).toBeGreaterThan(1000);
    expect(resp2.key).toBe(event.param2);
    expect(resp2.on).toBeGreaterThan(-1);
    expect(resp2.status).toEqual(22222);
    const exec2 = await idem.getExecution(`${prefix}:mykey1999`);
    expect(exec2.statusCompleted()).toBeTruthy();
  });

  it('Return X-Idempotency-From when called via API GW with default resp validator', async () => {
    await cancelExec('mykey2999');
    const handler = middy(async () => {
      return {
        body: 'something',
        statusCode: 201,
      };
    });

    handler.use(
      idempotenderMiddy({
        keyJmespath: 'param1',
        dynamoDBClient: testDynamoDBClient,
      }),
    );

    const event = {
      httpMethod: 'GET',
      param1: 'mykey2999',
    };

    // first call
    const resp: any = await handler(event, awsContext());
    expect(resp.idempotencyTime).not.toBeDefined();
    if (resp.headers) {
      expect(resp.headers['X-Idempotency-From']).not.toBeDefined();
    }

    // second call
    const resp2: any = await handler(event, awsContext());
    expect(resp2.idempotencyTime).toBeGreaterThan(1000);
    expect(resp2.headers['X-Idempotency-From']).toBeDefined();
  });

  it('Dont return idempotency marks in responses if configured to', async () => {
    await cancelExec('mykey3999');
    const handler = middy(async () => {
      return {
        body: 'something',
        statusCode: 201,
      };
    });

    handler.use(
      idempotenderMiddy({
        keyJmespath: 'param1',
        markIdempotentResponse: false,
        dynamoDBClient: testDynamoDBClient,
      }),
    );

    const event = {
      httpMethod: 'GET',
      param1: 'mykey3999',
    };

    // first call
    const resp: any = await handler(event, awsContext());
    expect(resp.idempotencyTime).not.toBeDefined();
    if (resp.headers) {
      expect(resp.headers['X-Idempotency-From']).not.toBeDefined();
    }

    // second call
    const resp2: any = await handler(event, awsContext());
    expect(resp2.idempotencyTime).not.toBeDefined();
    if (resp.headers) {
      expect(resp.headers['X-Idempotency-From']).not.toBeDefined();
    }
  });

  it('Dont save responses with status != 2xx in idempotency (default behavior for API GW calls)', async () => {
    await cancelExec('mykey4999');
    const handler = middy(async () => {
      return {
        body: 'something',
        statusCode: 404,
      };
    });

    handler.use(
      idempotenderMiddy({
        keyJmespath: 'param1',
        dynamoDBClient: testDynamoDBClient,
      }),
    );

    const event = {
      httpMethod: 'GET',
      param1: 'mykey4999',
    };

    // first call
    const resp: any = await handler(event, awsContext());
    expect(resp.idempotencyTime).not.toBeDefined();

    // second call
    const resp2: any = await handler(event, awsContext());
    expect(resp2.idempotencyTime).not.toBeDefined();
  });

  it('If handler throws an exception, idempotency should be canceled', async () => {
    await cancelExec('mykey777');
    let runCount = 0;
    const handler = middy(async () => {
      runCount += 1;
      throw new Error('Something went wrong, man!');
    });
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));
    const event = { param1: 'mykey777', param2: 'something else' };

    const invokeHandler = async (): Promise<void> => {
      return handler(event, awsContext());
    };

    await expect(invokeHandler).rejects.toThrowError();
    expect(runCount).toEqual(1);

    const exec7 = await idem.getExecution(`${prefix}:mykey777`);
    expect(exec7.statusOpen()).toBeTruthy();
    expect(exec7.statusLocked()).toBeFalsy();
    expect(exec7.statusCompleted()).toBeFalsy();
  });

  it('If handler throws an exception, idempotency should be canceled, even if another middleware changes the response "onError"', async () => {
    await cancelExec('mykey888');
    let runCount = 0;
    const handler = middy(async (): Promise<any> => {
      runCount += 1;
      throw new Error('Something went wrong, man!');
    });
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient })).onError(async (request) => {
      request.response = {
        statusCode: 412,
        body: 'Sorry. Try again later',
      };
    });
    const event = { param1: 'mykey888', param2: 'something else' };

    const resp = await handler(event, awsContext());
    expect(resp).toEqual({
      statusCode: 412,
      body: 'Sorry. Try again later',
    });

    const resp2 = await handler(event, awsContext());
    expect(resp2).toEqual({
      statusCode: 412,
      body: 'Sorry. Try again later',
    });

    expect(runCount).toEqual(2);

    const exec = await idem.getExecution(`${prefix}:mykey888`);
    expect(exec.statusOpen()).toBeTruthy();
    expect(exec.statusLocked()).toBeFalsy();
    expect(exec.statusCompleted()).toBeFalsy();
  });

  it('Multiple calls with the same input should return same result without running twice', async () => {
    await cancelExec('mykey222');
    let runCount = 0;
    const handler = middy(async (request: any) => {
      runCount += 1;
      return {
        message: request.param2,
        on: randomInt(),
      };
    });
    handler.use(idempotenderMiddy({ keyJmespath: 'param1', dynamoDBClient: testDynamoDBClient }));

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
    await cancelExec('mykey333');
    await cancelExec('mykey444');
    await cancelExec('mykey555');
    await cancelExec('mykey666');
    let runCount = 0;
    let runAfterCount = 0;
    let runBeforeCount = 0;
    const handler = middy(async (request: any) => {
      runCount += 1;
      // await sleep(30); // will force parallelism but it's not working - making jest hang
      return {
        message: request.param2,
        on: randomInt(),
      };
    });
    handler
      .before(() => {
        runBeforeCount += 1;
      })
      .use(
        idempotenderMiddy({
          keyJmespath: 'param1',
          lockAcquireTimeout: 600,
          lockTTL: 700,
          executionTTL: 1200,
          dynamoDBClient: testDynamoDBClient,
        }),
      )
      .after(() => {
        runAfterCount += 1;
      });

    const handlerPromises = [];
    const event = { param1: 'mykey333', param2: 'something else' };
    const event2 = { param1: 'mykey444', param2: 'something else' };
    const event3 = { param1: 'mykey555', param2: 'something else' };
    const event4 = { param1: 'mykey666', param2: 'something else' };
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event, awsContext()));
    }
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event2, awsContext()));
    }
    for (let i = 0; i < 30; i += 1) {
      handlerPromises.push(handler(event3, awsContext()));
    }
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

const cancelExec = async (id: string): Promise<void> => {
  const exec1 = await idem.getExecution(`${prefix}:${id}`);
  await exec1.cancel();
};
