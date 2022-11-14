import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import {
  lockAcquire,
  completeExecution,
  deleteExecution,
  fetchExecution,
  setDynamoDBClient,
} from './db';

const config = {
  dynamoDBTableName: 'IdempotencyExecutions',
  lockEnable: true,
  lockTTL: 60,
  executionTTL: 24 * 3600,
  keyHash: true,
  lockAcquireTimeout: 10,
};
const ddbclient = new DynamoDBClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  region: 'local',
});
setDynamoDBClient(ddbclient);

describe('when using local dynamodb', () => {
  it('should be able to save and fetch execution (with string)', async () => {
    await deleteExecution('111', config);
    await completeExecution('111', 'ABC', config);
    const result = await fetchExecution<string>('111', config);
    expect(result?.key).toEqual('111');
    expect(result?.outputSaved).toBeTruthy();
    expect(result?.outputValue.data).toEqual('ABC');
    expect(result?.lockTTL).toEqual(0);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to acquire lock execution (with string)', async () => {
    await deleteExecution('222', config);
    await lockAcquire('222', config);
    const result = await fetchExecution<string>('222', config);
    expect(result?.key).toEqual('222');
    expect(result?.outputSaved).toBeFalsy();
    expect(result?.outputValue.data).toEqual('');
    // prettier-ignore
    expect(result?.lockTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 10);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to delete execution (with string)', async () => {
    await deleteExecution('333', config);
    await completeExecution('333', 'XYZ', config);
    await deleteExecution('333', config);
    const result = await fetchExecution<string>('333', config);
    expect(result).toBeNull();
  });

  it('should be able to save and fetch execution (with complex object)', async () => {
    await deleteExecution('111', config);
    await completeExecution('111', { mydata: 'ABC', other: 'XYZ' }, config);
    const result = await fetchExecution<{ mydata: string; other: string }>('111', config);
    expect(result?.key).toEqual('111');
    expect(result?.outputSaved).toBeTruthy();
    expect(result?.outputValue.data).toEqual({ mydata: 'ABC', other: 'XYZ' });
    expect(result?.lockTTL).toEqual(0);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to save and fetch execution (with number)', async () => {
    await deleteExecution('111', config);
    await completeExecution('111', 123, config);
    const result = await fetchExecution<number>('111', config);
    expect(result?.key).toEqual('111');
    expect(result?.outputSaved).toBeTruthy();
    expect(result?.outputValue.data).toEqual(123);
    expect(result?.lockTTL).toEqual(0);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to save and fetch execution (with null)', async () => {
    await deleteExecution('111', config);
    await completeExecution('111', null, config);
    const result = await fetchExecution<null>('111', config);
    expect(result?.key).toEqual('111');
    expect(result?.outputSaved).toBeTruthy();
    expect(result?.outputValue.data).toBeNull();
    expect(result?.outputValue.ts).toBeGreaterThan(100);
    expect(result?.lockTTL).toEqual(0);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });
});
