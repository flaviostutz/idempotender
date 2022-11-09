import { Context } from 'aws-lambda';

const awsContext = ():Context => {
  return {
    functionName: 'mockFunc',
    callbackWaitsForEmptyEventLoop: true,
    invokedFunctionArn: 'arn:aws:lambda:us-west-2:123456789012:function:my-function',
    memoryLimitInMB: '256',
    awsRequestId: 'id',
    functionVersion: '2',
    logGroupName: 'logGroup',
    logStreamName: 'Stream',
    getRemainingTimeInMillis: jest.fn(),
    done: jest.fn(),
    fail: jest.fn(),
    succeed: jest.fn(),
  };
};

export { awsContext };
