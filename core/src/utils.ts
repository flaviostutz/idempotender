/* eslint-disable id-length */
import { AttributeValue } from '@aws-sdk/client-dynamodb';

import { ExecutionData } from './types/ExecutionData';
import { ExecutionStatus } from './types/ExecutionStatus';

const dynamoToExecutionData = (item: Record<string, AttributeValue>): ExecutionData => {
  return {
    key: item.Id.S || '',
    lockTTL: item.lockTTL.N ? parseInt(item.lockTTL.N, 10) : 0,
    executionTTL: item.executionTTL.N ? parseInt(item.executionTTL.N, 10) : 0,
    outputSaved: item.outputSaved.BOOL || false,
    outputValue: item.outputValue.S || '',
  };
};

const executionDataToDynamo = (executionData: ExecutionData): Record<string, AttributeValue> => {
  return {
    Id: { S: executionData.key },
    lockTTL: { N: `${executionData.lockTTL}` },
    executionTTL: { N: `${executionData.executionTTL}` },
    outputSaved: { BOOL: executionData.outputSaved },
    outputValue: { S: executionData.outputValue },
  };
};

const getExecutionStatus = (executionData: ExecutionData | null): ExecutionStatus => {
  if (!executionData) {
    return ExecutionStatus.OPEN;
  }

  const nowEpoch = new Date().getTime() / 1000.0;
  // execution expired
  if (nowEpoch > executionData.executionTTL) {
    return ExecutionStatus.OPEN;
  }

  // execution completed
  if (executionData.outputSaved) {
    return ExecutionStatus.COMPLETED;
  }

  // lock active
  if (nowEpoch < executionData.lockTTL) {
    return ExecutionStatus.LOCKED;
  }

  return ExecutionStatus.OPEN;
};

const sleep = async (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export { dynamoToExecutionData, executionDataToDynamo, getExecutionStatus, sleep };

