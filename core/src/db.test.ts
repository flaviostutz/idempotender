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
  keyJmespath: null,
  keyMapper: null,
  keyHash: true,
  lockAcquireTimeout: 10,
};
const ddbclient = new DynamoDBClient({
  endpoint: process.env.MOCK_DYNAMODB_ENDPOINT,
  region: 'local',
});
setDynamoDBClient(ddbclient);

describe('when using local dynamodb', () => {
  it('should be able to save and fetch execution', async () => {
    await deleteExecution('111', config);
    await completeExecution('111', 'ABC', config);
    const result = await fetchExecution('111', config);
    expect(result?.key).toEqual('111');
    expect(result?.outputSaved).toBeTruthy();
    expect(result?.outputValue).toEqual('ABC');
    expect(result?.lockTTL).toEqual(0);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to acquire lock execution', async () => {
    await deleteExecution('222', config);
    await lockAcquire('222', config);
    const result = await fetchExecution('222', config);
    expect(result?.key).toEqual('222');
    expect(result?.outputSaved).toBeFalsy();
    expect(result?.outputValue).toEqual('');
    // prettier-ignore
    expect(result?.lockTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 10);
    // prettier-ignore
    expect(result?.executionTTL).toBeGreaterThan((new Date().getTime() / 1000.0) + 3600);
  });

  it('should be able to delete execution', async () => {
    await deleteExecution('333', config);
    await completeExecution('333', 'XYZ', config);
    await deleteExecution('333', config);
    const result = await fetchExecution('333', config);
    expect(result).toBeNull();
  });
});
