import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { setDynamodDBClient, deleteExecution } from './db';
import { idempotender } from './idempotender';
import { sleep } from './utils';

describe('when using idempotender with default configurations', () => {

  beforeAll(async () => {
    const config = { dynamoDBTableName: 'IdempotencyExecutions' };
    const ddbclient = new DynamoDBClient({
      endpoint: 'http://localhost:8000',
      region: 'local-env',
    });
    setDynamodDBClient(ddbclient);
    await deleteExecution('1123', config);
    await deleteExecution('2123', config);
    await deleteExecution('3123', config);
    await deleteExecution('4123', config);
    await deleteExecution('5123', config);
    await deleteExecution('6123', config);
    await deleteExecution('7123', config);
    await deleteExecution('8123', config);
  });

  it('map key with embedded jmespath should work', () => {
    const idem = idempotender({ keyJmespath: 'key1' });
    const res = idem.mapKey({ key1: 'value1' });
    expect(res).toEqual('value1');
  });

  it('map key with embedded jmespath should work 2', () => {
    const idem = idempotender({ keyJmespath: 'key1.key2[1]' });
    const res = idem.mapKey({ key1: { key2: ['test1', 'test2', 'test3'] } });
    expect(res).toEqual('test2');
  });

  it('get inexistant execution should lead to "open" state', async () => {
    const idem = idempotender({ keyJmespath: 'key1' });
    const res = await idem.getExecution('1123');
    expect(res.statusOpen()).toBeTruthy();
  });

  it('save execution should lead to "completed" state', async () => {
    const idem = idempotender({ keyJmespath: 'key1' });
    const res = await idem.getExecution('2123');
    await res.complete('test');
    const res2 = await idem.getExecution('2123');
    expect(res2.statusOpen()).toBeFalsy();
    expect(res2.statusCompleted()).toBeTruthy();
  });

  it('cancel execution should lead to "open" state in subsequent calls', async () => {
    const idem = idempotender({ keyJmespath: 'key1' });

    const res = await idem.getExecution('3123');
    await res.complete('test');
    await res.cancel();

    // check
    const res2 = await idem.getExecution('3123');
    expect(res2.statusOpen()).toBeTruthy();
    expect(res2.statusCompleted()).toBeFalsy();
  });

  it('acquire lock should lead to "locked" state in parallel calls after timeout', async () => {
    const idem = idempotender({
      keyJmespath: 'key1',
      lockTTL: 2,
      lockAcquireTimeout: 1,
    });

    // should succeed with a lock
    const res1 = await idem.getExecution('4123');
    expect(res1.statusOpen()).toBeTruthy();

    // should be locked by the first call
    const res2 = await idem.getExecution('4123');
    expect(res2.statusLocked()).toBeTruthy();
  });

  it('second acquire lock should resolve to "completed" if first client resolves it under the lockAcquireTimeout time', async () => {
    const idem = idempotender({
      keyJmespath: 'key1',
      lockTTL: 3,
      lockAcquireTimeout: 2,
    });

    // should succeed with a lock
    const res1 = await idem.getExecution('5123');
    expect(res1.statusOpen()).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setTimeout(() => { res1.complete('test2'); }, 1000);

    // should be locked by the first call, but it will retry
    // and as the first process will complete it, this should
    // return gracefully with the newer state set by the first process
    const res2 = await idem.getExecution('5123');
    expect(res2.statusCompleted()).toBeTruthy();
    expect(res2.output()).toEqual('test2');
  });

  it('second acquire lock should resolve to "open" if first client cancels it under the lockAcquireTimeout time', async () => {
    const idem = idempotender({
      keyJmespath: 'key1',
      lockTTL: 3,
      lockAcquireTimeout: 2,
    });

    // should succeed with a lock
    const res1 = await idem.getExecution('6123');
    expect(res1.statusOpen()).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    setTimeout(() => { res1.cancel(); }, 1000);

    // should be locked by the first call, but it will retry
    // and as the first process will complete it, this should
    // return gracefully with the newer state set by the first process
    const res2 = await idem.getExecution('6123');
    expect(res2.statusOpen()).toBeTruthy();
  });

  it('"completed" execution should be back to "open" after execution expiration time', async () => {
    const idem = idempotender({
      keyJmespath: 'key1',
      lockTTL: 0.5,
      lockAcquireTimeout: 0.4,
      executionTTL: 1,
    });

    // should succeed with a lock
    const res1 = await idem.getExecution('7123');
    expect(res1.statusOpen()).toBeTruthy();
    await res1.complete('test3');

    const res2 = await idem.getExecution('7123');
    expect(res2.statusCompleted()).toBeTruthy();

    await sleep(1100);
    const res3 = await idem.getExecution('7123');
    expect(res3.statusOpen()).toBeTruthy();
  });

  it('"locked" execution should be back to "open" after lock expiration time', async () => {
    const idem = idempotender({
      keyJmespath: 'key1',
      lockTTL: 1.1,
      lockAcquireTimeout: 0.3,
      executionTTL: 3,
    });

    // should succeed with a lock
    const res1 = await idem.getExecution('8123');
    expect(res1.statusOpen()).toBeTruthy();
    // second process will see it locked at first
    const res2 = await idem.getExecution('8123');
    expect(res2.statusLocked()).toBeTruthy();

    await sleep(700);
    const res3 = await idem.getExecution('8123');
    expect(res3.statusOpen()).toBeTruthy();
  });


});
