import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpHeaderNormalizer from '@middy/http-header-normalizer';

async function lambdaHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log(event.body);
  const number = Math.round(Math.random() * 99999);
  return {
    statusCode: 200,
    body: JSON.stringify({
      number: `${number}`,
      timestamp: new Date().toISOString(),
    }),
  };
}

export const handler = middy(lambdaHandler)
  .use(jsonBodyParser())
  .use(httpHeaderNormalizer())
  .use(cors());

