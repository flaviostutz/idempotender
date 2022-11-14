/* eslint-disable id-length */
import {
  PutItemCommand,
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

import { ExecutionData } from './types/ExecutionData';
import { ExecutionOutput } from './types/ExecutionOutput';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { dynamoToExecutionData, executionDataToDynamo } from './utils';

let dynamodDBClient = new DynamoDBClient({});

const lockAcquire = async (key: string, config: IdempotenderConfig): Promise<boolean> => {
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
    await dynamodDBClient.send(command);
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
  const command = new GetItemCommand({
    TableName: config.dynamoDBTableName,
    Key: { Id: { S: key } },
    ConsistentRead: true,
  });

  const response = await dynamodDBClient.send(command);
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
  await dynamodDBClient.send(command);
};

const completeExecution = async <T>(
  key: string,
  output: T,
  config: IdempotenderConfig,
): Promise<ExecutionOutput<T>> => {
  if (!config.executionTTL) {
    throw new Error('executionTTL should be defined');
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
  await dynamodDBClient.send(command);
  return execOutput;
};

/**
 * Setups a custom dynamodb client to be used on all db interactions
 * @param ddbclient DynamoDB client
 */
const setDynamoDBClient = (ddbclient: DynamoDBClient): void => {
  dynamodDBClient = ddbclient;
};

export { lockAcquire, fetchExecution, deleteExecution, completeExecution, setDynamoDBClient };
