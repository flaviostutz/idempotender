/* eslint-disable id-length */
import {
  PutItemCommand,
  DynamoDBClient,
  GetItemCommand,
  DeleteItemCommand,
} from '@aws-sdk/client-dynamodb';

import { ExecutionData } from './types/ExecutionData';
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
    outputValue: '',
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


const fetchExecution = async (
  key: string,
  config: IdempotenderConfig,
): Promise<ExecutionData | null> => {
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

const completeExecution = async (
  key: string,
  output: string,
  config: IdempotenderConfig,
): Promise<void> => {
  if (!config.executionTTL) {
    throw new Error('executionTTL should be defined');
  }
  // prettier-ignore
  const executionData = {
    key,
    lockTTL: 0,
    executionTTL: (new Date().getTime() / 1000.0) + config.executionTTL,
    outputSaved: true,
    outputValue: output,
  };
  const command = new PutItemCommand({
    TableName: config.dynamoDBTableName,
    Item: executionDataToDynamo(executionData),
  });
  await dynamodDBClient.send(command);
};

const setDynamoDBClient = (ddbclient: DynamoDBClient): void => {
  dynamodDBClient = ddbclient;
};

export { lockAcquire, fetchExecution, deleteExecution, completeExecution, setDynamoDBClient };
