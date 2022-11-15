import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { deleteExecution } from './db';
import { core } from './core';
import { sleep } from './utils';

const testConfig = {
  dynamoDBTableName: 'IdempotencyExecutions',
  dynamoDBClient: new DynamoDBClient({
    endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
    region: 'local',
  }),
};

describe('when using core with custom testConfigurations', () => {
  it('get inexistant execution should lead to "open" state', async () => {
    await deleteExecution('1123', testConfig);
    const idem = core<string>(testConfig);
    const res = await idem.getExecution('1123');
    expect(res.statusOpen()).toBeTruthy();
  });

  it('save execution should lead to "completed" state', async () => {
    await deleteExecution('2123', testConfig);
    const idem = core(testConfig);
    const res = await idem.getExecution('2123');
    await res.complete('test');
    const res2 = await idem.getExecution('2123');
    expect(res2.statusOpen()).toBeFalsy();
    expect(res2.statusCompleted()).toBeTruthy();
  });

  it('save execution should not take too long for large keys', async () => {
    const idem = core(testConfig);
    const key =
      'dkfjahjlkd hlakfhkaf kadshjfalkdsjhfdlakshj alkdfhj alkdshfjadlskfhj adlksfh adslkaf dsklf dsklhaf dsklhaf sdkljhf kj3h4 l2k3hj4 23482734 9a7ef9asdfjhasdgf asdifg a897t 2398472j kaegfasgdf a87f 9a8ew7fta8w9ef7aewi jhfg aewifg aew987t 2394t234324hjk32432jh aw987ft a9df9a8s7df6987629842ji4hg23i gr23qig iuyg asdfhgaskdjhgfdas87f6ads867f5das786f5as678fads8765fdsg6adsf876dg8787fg87asfg8a7ds6fga87dsfa87dsfa87g5 a78g5 a5a7d5 af gf5 678dsafg a678dsf5g 8a7ds65fg a5a786d5f ad5dkfjahjlkd hlakfhkaf kadshjfalkdsjhfdlakshj alkdfhj alkdshfjadlskfhj adlksfh adslkaf dsklf dsklhaf dsklhaf sdkljhf kj3h4 l2k3hj4 23482734 9a7ef9asdfjhasdgf asdifg a897t 2398472j kaegfasgdf a87f 9a8ew7fta8w9ef7aewi jhfg aewifg aew987t 2394t234324hjk32432jh aw987ft a9df9a8s7df6987629842ji4hg23i gr23qig iuyg asdfhgaskdjhgfdas87f6ads867f5das786f5as678fads8765fdsg6adsf876dg8787fg87asfg8a7ds6fga87dsfa87dsfa87g5 a78g5 a5a7d5 af gf5 678dsafg a678dsf5g 8a7ds65fg a5a786d5f ad5dkfjahjlkd hlakfhkaf kadshjfalkdsjhfdlakshj alkdfhj alkdshfjadlskfhj adlksfh adslkaf dsklf dsklhaf dsklhaf sdkljhf kj3h4 l2k3hj4 23482734 9a7ef9asdfjhasdgf asdifg a897t 2398472j kaegfasgdf a87f 9a8ew7fta8w9ef7aewi jhfg aewifg aew987t 2394t234324hjk32432jh aw987ft a9df9a8s7df6987629842ji4hg23i gr23qig iuyg asdfhgaskdjhgfdas87f6ads867f5das786f5as678fads8765fdsg6adsf876dg8787fg87asfg8a7ds6fga87dsfa87dsfa87g5 a78g5 a5a7d5 af gf5 678dsafg a678dsf5g 8a7ds65fg a5a786d5f ad5dkfjahjlkd hlakfhkaf kadshjfalkdsjhfdlakshj alkdfhj alkdshfjadlskfhj adlksfh adslkaf dsklf dsklhaf dsklhaf sdkljhf kj3h4 l2k3hj4 23482734 9a7ef9asdfjhasdgf asdifg a897t 2398472j kaegfasgdf a87f 9a8ew7fta8w9ef7aewi jhfg aewifg aew987t 2394t234324hjk32432jh aw987ft a9df9a8s7df6987629842ji4hg23i gr23qig iuyg asdfhgaskdjhgfdas87f6ads867f5das786f5as678fads8765fdsg6adsf876dg8787fg87asfg8a7ds6fga87dsfa87dsfa87g5 a78g5 a5a7d5 af gf5 678dsafg a678dsf5g 8a7ds65fg a5a786d5f ad5';
    const res = await idem.getExecution(key);
    await res.complete('test');
    const res2 = await idem.getExecution(key);
    expect(res2.statusOpen()).toBeFalsy();
    expect(res2.statusCompleted()).toBeTruthy();
  });

  it('save execution should lead to "completed" state even if not using hash', async () => {
    await deleteExecution('h2123', testConfig);
    const idem = core({ ...testConfig, ...{ keyHash: false } });
    const res = await idem.getExecution('h2123');
    await res.complete('test');
    const res2 = await idem.getExecution('h2123');
    expect(res2.statusOpen()).toBeFalsy();
    expect(res2.statusCompleted()).toBeTruthy();
  });

  it('cancel execution should lead to "open" state in subsequent calls', async () => {
    await deleteExecution('3123', testConfig);
    const idem = core(testConfig);

    const res = await idem.getExecution('3123');
    await res.complete('test');
    await res.cancel();

    // check
    const res2 = await idem.getExecution('3123');
    expect(res2.statusOpen()).toBeTruthy();
    expect(res2.statusCompleted()).toBeFalsy();
  });

  it('acquire lock should lead to "locked" state in parallel calls after timeout', async () => {
    await deleteExecution('4123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockTTL: 2,
      lockAcquireTimeout: 1,
    } });

    // should succeed with a lock
    const res1 = await idem.getExecution('4123');
    expect(res1.statusOpen()).toBeTruthy();

    // should be locked by the first call
    const res2 = await idem.getExecution('4123');
    expect(res2.statusLocked()).toBeTruthy();
  });

  it('second acquire lock should resolve to "completed" if first client resolves it under the lockAcquireTimeout time', async () => {
    await deleteExecution('5123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockTTL: 3,
      lockAcquireTimeout: 2,
    } });

    // should succeed with a lock
    const res1 = await idem.getExecution('5123');
    expect(res1.statusOpen()).toBeTruthy();

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      res1.complete('test2');
    }, 1000);

    // should be locked by the first call, but it will retry
    // and as the first process will complete it, this should
    // return gracefully with the newer state set by the first process
    const res2 = await idem.getExecution('5123');
    expect(res2.statusCompleted()).toBeTruthy();
    expect(res2.output().data).toEqual('test2');
  });

  it('second acquire lock should resolve to "open" if first client cancels it under the lockAcquireTimeout time', async () => {
    await deleteExecution('6123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockTTL: 3,
      lockAcquireTimeout: 2,
    } });

    // should succeed with a lock
    const res1 = await idem.getExecution('6123');
    expect(res1.statusOpen()).toBeTruthy();

    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      res1.cancel();
    }, 1000);

    // should be locked by the first call, but it will retry
    // and as the first process will complete it, this should
    // return gracefully with the newer state set by the first process
    const res2 = await idem.getExecution('6123');
    expect(res2.statusOpen()).toBeTruthy();
  });

  it('"completed" execution should be back to "open" after execution expiration time', async () => {
    await deleteExecution('7123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockTTL: 0.5,
      lockAcquireTimeout: 0.4,
      executionTTL: 1,
    } });

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
    await deleteExecution('8123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockTTL: 1.1,
      lockAcquireTimeout: 0.3,
      executionTTL: 3,
    } });

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

  it('lock shouldnt be acquired if lockEnable==false in testConfig', async () => {
    await deleteExecution('9123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockEnable: false,
    } });

    // should succeed without a lock
    const res1 = await idem.getExecution('9123');
    expect(res1.statusOpen()).toBeTruthy();

    // shouldnt be locked by the first call
    // (which could lead to dirt writes, but it's expected)
    const res2 = await idem.getExecution('9123');
    expect(res2.statusOpen()).toBeTruthy();
  });

  it('second client should see "complete" status after first client "completes" it when not using locks', async () => {
    await deleteExecution('10123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockEnable: false,
    } });

    // should succeed without a lock
    const res1 = await idem.getExecution('10123');
    expect(res1.statusOpen()).toBeTruthy();
    await res1.complete('res1value');
    expect(res1.statusCompleted()).toBeTruthy();

    const res2 = await idem.getExecution('10123');
    expect(res2.statusCompleted()).toBeTruthy();
    expect(res2.output().data).toEqual('res1value');
  });

  it('when two clients run in parallel, the later writer whould overwrite the first when no lock is used', async () => {
    await deleteExecution('11123', testConfig);
    const idem = core({ ...testConfig, ...{
      lockEnable: false,
    } });

    // first client reads state
    const res1 = await idem.getExecution('11123');
    expect(res1.statusOpen()).toBeTruthy();

    // second client reads state (but gets no lock)
    const res2 = await idem.getExecution('11123');
    expect(res2.statusOpen()).toBeTruthy();

    // first "completes"
    await res1.complete('res1value');
    expect(res1.statusCompleted()).toBeTruthy();

    // second "completes" (and overwrites first)
    await res1.complete('res2value');
    expect(res1.statusCompleted()).toBeTruthy();

    // the final state contains data from the second client
    const res3 = await idem.getExecution('11123');
    expect(res3.statusCompleted()).toBeTruthy();
    expect(res3.output().data).toEqual('res2value');
  });
});
