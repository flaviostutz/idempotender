/* eslint-disable id-length */
import { AttributeValue } from '@aws-sdk/client-dynamodb';

import { ExecutionData } from './types/ExecutionData';
import { ExecutionStatus } from './types/ExecutionStatus';

const dynamoToExecutionData = <T>(item: Record<string, AttributeValue>): ExecutionData<T> => {
  const outputstr = item.outputValue.S || '';
  const eoutput = JSON.parse(outputstr);

  return {
    key: item.Id.S || '',
    lockTTL: item.lockTTL.N ? parseInt(item.lockTTL.N, 10) : 0,
    executionTTL: item.executionTTL.N ? parseInt(item.executionTTL.N, 10) : 0,
    outputSaved: item.outputSaved.BOOL || false,
    outputValue: eoutput,
  };
};
const executionDataToDynamo = <T>(
  executionData: ExecutionData<T>,
): Record<string, AttributeValue> => {
  // wrap output object so any content type can be saved
  const outputstr = JSON.stringify(executionData.outputValue);

  return {
    Id: { S: executionData.key },
    lockTTL: { N: `${executionData.lockTTL}` },
    executionTTL: { N: `${executionData.executionTTL}` },
    outputSaved: { BOOL: executionData.outputSaved },
    outputValue: { S: outputstr },
  };
};

const getExecutionStatus = <T>(executionData: ExecutionData<T> | null): ExecutionStatus => {
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
