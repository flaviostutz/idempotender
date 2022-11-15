import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import idempotenderMiddy from '@idempotender/middy';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

let dynamoDBClient = new DynamoDBClient({});
if (process.env.STAGE === 'local') {
  dynamoDBClient = new DynamoDBClient({
    endpoint: 'http://localhost:8000',
    region: 'local',
  });
}

async function lambdaHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log(event.body);
  const number = Math.round(Math.random() * 99999);
  return {
    statusCode: 200,
    body: JSON.stringify({
      number,
      timestamp: new Date().toISOString(),
    }),
  };
}

export const handler = middy(lambdaHandler)
  .use(idempotenderMiddy({
    keyJmespath: '[method,path]',
    dynamoDBClient,
    executionTTL: 5,
    lockTTL: 2,
    lockAcquireTimeout: 1,
  }))
  .use(jsonBodyParser())
  .use(httpHeaderNormalizer())
  .use(cors());
