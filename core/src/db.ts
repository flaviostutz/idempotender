/* eslint-disable id-length */
import {
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  DynamoDBClient,
} from '@aws-sdk/client-dynamodb';

import { ExecutionData } from './types/ExecutionData';
import { ExecutionOutput } from './types/ExecutionOutput';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { dynamoToExecutionData, executionDataToDynamo } from './utils';

const lockAcquire = async (key: string, config: IdempotenderConfig): Promise<boolean> => {
  if (!config.dynamoDBClient) {
    config.dynamoDBClient = new DynamoDBClient({});
  }
  // put lockTTL=[date in future] with condition lockTTL==0
  if (!config.executionTTL) {
    throw new Error('executionTTL shouldnt be null');
  }
  if (!config.lockTTL) {
    throw new Error('lockTTL shouldnt be null');
  }
  // prettier-ignore
  const executionData = {
    key,
    lockTTL: (new Date().getTime() / 1000.0) + config.lockTTL,
    executionTTL: (new Date().getTime() / 1000.0) + config.executionTTL,
    outputSaved: false,
    outputValue: { data: '', ts: 0 },
  };
  const command = new PutItemCommand({
    TableName: config.dynamoDBTableName,
    Item: executionDataToDynamo(executionData),
    ConditionExpression: 'attribute_not_exists(Id) OR lockTTL = :l',
    ExpressionAttributeValues: {
      ':l': { N: '0' },
    },
  });

  try {
    await config.dynamoDBClient.send(command);
    return true;
  } catch (err: any) {
    if (err.name !== 'ConditionalCheckFailedException') {
      throw err;
    }
    return false;
  }
};

const fetchExecution = async <T>(
  key: string,
  config: IdempotenderConfig,
): Promise<ExecutionData<T> | null> => {
  if (!config.dynamoDBClient) {
    config.dynamoDBClient = new DynamoDBClient({});
  }
  const command = new GetItemCommand({
    TableName: config.dynamoDBTableName,
    Key: { Id: { S: key } },
    ConsistentRead: true,
  });

  const response = await config.dynamoDBClient.send(command);
  if (response.Item) {
    return dynamoToExecutionData(response.Item);
  }
  return null;
};

const deleteExecution = async (key: string, config: IdempotenderConfig): Promise<void> => {
  const command = new DeleteItemCommand({
    TableName: config.dynamoDBTableName,
    Key: { Id: { S: key } },
  });
  if (!config.dynamoDBClient) {
    config.dynamoDBClient = new DynamoDBClient({});
  }
  await config.dynamoDBClient.send(command);
};

const completeExecution = async <T>(
  key: string,
  output: T,
  config: IdempotenderConfig,
): Promise<ExecutionOutput<T>> => {
  if (!config.executionTTL) {
    throw new Error('executionTTL should be defined');
  }
  if (!config.dynamoDBClient) {
    config.dynamoDBClient = new DynamoDBClient({});
  }

  const execOutput = {
    data: output,
    ts: new Date().getTime(),
  };

  // prettier-ignore
  const executionData = {
    key,
    lockTTL: 0,
    executionTTL: (new Date().getTime() / 1000.0) + config.executionTTL,
    outputSaved: true,
    outputValue: execOutput,
  };
  const command = new PutItemCommand({
    TableName: config.dynamoDBTableName,
    Item: executionDataToDynamo(executionData),
  });
  await config.dynamoDBClient.send(command);
  return execOutput;
};

export { lockAcquire, fetchExecution, deleteExecution, completeExecution };
