import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import jsonBodyParser from '@middy/http-json-body-parser';
import httpHeaderNormalizer from '@middy/http-header-normalizer';
import axios from 'axios';

async function lambdaHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log(event.body);

  let results = 5;
  if (event.queryStringParameters) {
    const { presults } = <any>event.queryStringParameters;
    results = presults;
  }
  const resp = await axios.get(`https://randomuser.me/api/?results=${results}`);

  return {
    statusCode: 200,
    body: JSON.stringify(resp.data),
  };
}

export const handler = middy(lambdaHandler)
  .use(jsonBodyParser())
  .use(httpHeaderNormalizer())
  .use(cors());
