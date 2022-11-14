# idempotender

Middy middleware for making AWS Lambda Functions imdepotent.

Create a DynamoDB table and add this middleware to Middy so it selects a certain input attribute as the idempotency key and your function will start being idempontent.

The overall steps that this middlware performs are:

- At the beginning of the function execution, it will extract a key from the input and look for that "execution" in DynamoDB
- In general, if the key exists in a DynamoDB table, it means this execution was already done, so the middleware get the previous output and return it to the Lambda function caller. The caller won't know it wasn't really executed, and will receive the same response as the first client, which is expected.
- If the key doesn't exist, then actual function handler will be run and at the end the middleware will save the output to DynamoDB table before returning it to the caller
- Imdepondenter will control a lock between two parallel requests so only one request will be processed at a time for a specific key and the second one will receive the same contents of the first request, but the actual handler logic will run only once

## Usage

- `npm install --save @idempotender/middy`

- Create DynamoDB table with structure:

```yml
Resources:
  IdempotencyExecutions:
    Type: AWS::DynamoDB::Table
    Properties:
      AttributeDefinitions:
        - AttributeName: Id
          AttributeType: S
      KeySchema:
        - AttributeName: Id
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: executionTTL
        Enabled: true
```

### Example: Simple Lambda

- In this example, we will use attribute 'param1' from event as the key of idempotency while hashing and using lock to avoid concurrency

- Create Lambda function

```js
import idempotenderMiddy from '@idempotender/middy';

const handler = middy((event, context) => {
  console.log(`Running for '${event.param1}' on ${new Date()}`);
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotenderMiddy({
    keyJmespath: 'param1',
  }),
);
```

### Example: Lambda called via REST API

- In this example, the Lambda is invoked through AWS API Gateway, so we select attributes 'method', 'path' and request 'body' from event as the key of idempotency.

- The extracted key will then be hashed before being stored in database, so data is not exposed, but you have a very very tiny change of collision (we use hash-256).

- Create AWS Lambda function exposed through AWS API Gateway

```js
import idempotenderMiddy from '@idempotender/middy';

const handler = middy((event, context) => {
  console.log('Will only execute this once for the same URL method + path + body contents');
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotender({
    keyJmespath: '[method, path, body]',
  }),
);
```

### Example: Lambda called via REST API with Idempotency-Key header

- In this example, the Lambda is invoked through AWS API Gateway, and we will use Stripe style for controlling the idempotency key (header Idempotency-Key). See https://stripe.com/docs/api/idempotent_requests.

- We won't use hash and the quality of the idempotency key is responsability of the caller.

- The idempotency key will be valid for 24h, which means that another call with the same idempotency header after 24h will make the function run again.

- Create AWS Lambda function exposed through AWS API Gateway

```js
import idempotenderMiddy from '@idempotender/middy';

const handler = middy((event, context) => {
  console.log('Will only execute this once per "Idempotency-Key" header value');
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotenderMiddy({
    keyHash: false,
    executionTTL: 24 * 3600,
    keyJmespath: "[headers['Idempotency-Key']]",
  }),
);
```

## Key selection

- This is critical for a good Idempotency implementation, as it dictates what is the domain of an idempotent execution. keyJmespath (or a custom mapper) have to be specifically crafted for your application, as it requires specific knowledge about the input of the Lambda function and which attributes must be taken in consideration for selecting a key.

- Select a key that uniquely identifies a specific call. Two call to the same key will result in the same contents, having only the first call actually processed and the second one returning the cached contents from the previous execution.

- You might be tempted to use the entire input as the source of this key, but probably it will have timestamp based data about when the call was made, or client information (such as user agent, capabilities) that that not necessarily is used as the basis for defining idempotency

- Use configuration keyJmespath or keyMapper to define how to extract the key from the input of the function

- Idempotender prefixes the key with the number part of your Lambda ARN, so you can reuse the same DynamoDB for multiple Lambda functions without the risk of collision between them.

## Identification of a successful execution

- It's important to be clear about if the response of a execution indicates a successful execution so Idempotender decides to store its output or cancels the lock for a later retry by the client in case there is a temporary error going on.

- If you don't evaluate clearly, an error "500" can be considered "normal" and then the actual execution won't be retried until the execution timeout expires (sometimes it can be only in 24h, for example) then your application can be stuck for a while.

- The execution is considered failed:

  - Always when the handler function throws an exception
    - It is canceled even when another middleware changes the response on "onError" callback and middy doesn't rethrow the exception
    - It means that maybe you can return a custom response when an exception happens and it wont prevent the idempotent execution to be canceled
    - Throwing an exception is the best way to indicate that something unexpected happened, for example, X-Ray uses it to identify root causes
  - Always when the response is "not valid"
    - jmespath query from 'config.validResponseJmespath' is run against the response object to evaluate if it's valid or not
    - This is evaluated only when the response is an object or a string that contains json contents

- When an execution is failed, the lock will be cancelled and the execution response won't be saved/reused in later calls

## Reference

- These are the default values of the configuration

```js
const idem = idempotenderMiddy({
  dynamoDBTableName: 'IdempotencyExecutions',
  lockEnable: true,
  lockTTL: 60,
  executionTTL: 24 * 3600,
  keyHash: true,
  lockAcquireTimeout: 10,
  keyJmespath: null,
  keyMapper: null,
  markIdempotentResponse: true,
  validResponseJmespath: "statusCode >= `200` && statusCode < `300`" (if called from API GW)
}
```

- You must use idempotender middleware as the first middleware in the chain so that it can store the response after all other middlewares are executed and be the first to return when a idempotent call is detected

```js
// example
handler.use(idempotenderMiddy(config)).use(httpErrorHandler()).use(cors());
```

- Config attributes:

  - **dynamoDBTableName**

    - DynamoDB table to use for controlling idempotency

    - Defaults to 'IdempotencyExecutions'

  - **lockEnable**

    - Avoids parallel concurrency situations in which, while the first execution is running, another request arrives (before the first is finished)

    - In this situation, the second request will be responded with error 409 (conflict) so the client can resubmit it again later (and then receive a valid response, cached from the first run - because of the idempotency)

    - Activating this may increase your DynamoDB costs by ~3x, but is recommended because it's safer

    - Defaults to 'true'

  - **lockTTL**

    - Time in seconds that the concurrency lock will be active. During this timespan, if another request arrives, before the first request is finished, it will receive a status 419 (see lockEnable)

    - Defaults to '10'

  - **lockAcquireTimeout**

    - Time in seconds waiting for an existing lock to be released in case of concurrency. If the lock is released in this period, we will try to get the last saved output from the other process (if it was saved) and return the previous output gracefully. If after lock is released the output was not saved, we will try to acquire the lock again.

    - Defaults to '15'

  - **executionTTL**

    - Time in seconds after execution is finished in which if another request with the same key arrives, will be responded with the first execution response.

    - The actual execution will be skipped, but the client will receive the same response as in the first call.

    - Defaults to '24 \* 3600'

  - **keyMapper**

    - A function that receives the input data and returns the key used by the idempotency control

    - Defaults to a jmespath data extractor, controlled by option 'keyJmespath'

  - **keyJmespath**

    - jmespath expression used for extracting the database key from input data. Check https://jmespath.org/tutorial.html

    - Required if no custom keyMapper is used. Not used if 'keyMapper' is defined.

  - **validResponseJmespath**

    - jmespath expression that is executed against the response and returns a boolean value indicating if the contents are valid or not

    - If response is a string, Idempotender will try to parse it as json and do the check

    - If not defined and called from API GW, defaults to 'statusCode >= \`200\` && statusCode < \`300'\`'

  - **keyHash**

    - Whatever hash the key before storing in the database or not

    - Useful in cases where the key is too large or you don't want to expose the input parameters in plain text in DynamoDB

    - This is applied after keyMapper is executed

    - SHA-256 is used, which is very secure, but keep in mind that there is a very low possibility of collisions if this is enabled.

    - Defaults to 'true'

## AWS inputs

When using Lambda with different callers, the input may have different data that you have to understand in order to create a good jmespath query for getting a good source of idempotency key.

See below some sample inputs depending on which service has called Lambda

### AWS API Gateway sample request

```json
{
  "resource": "/",
  "path": "/",
  "httpMethod": "GET",
  "requestContext": {
    "resourcePath": "/",
    "httpMethod": "GET",
    "path": "/Prod/"
  },
  "headers": {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
    "accept-encoding": "gzip, deflate, br",
    "Host": "70ixmpl4fl.execute-api.us-east-2.amazonaws.com",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
    "X-Amzn-Trace-Id": "Root=1-5e66d96f-7491f09xmpl79d18acf3d050"
  },
  "multiValueHeaders": {
    "accept": [
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9"
    ],
    "accept-encoding": ["gzip, deflate, br"]
  },
  "queryStringParameters": null,
  "multiValueQueryStringParameters": null,
  "pathParameters": null,
  "stageVariables": null,
  "body": null,
  "isBase64Encoded": false
}
```

## Special behaviors depending on AWS input

### When Lambda is invoked via AWS API GW

- The http header 'X-Idempotency-From' is added with the timestamp of the first call that actually run the function whe returning a cache response

- If "validResponseJmespath" config is not defined, it will default to 'statusCode >= \`200\` && statusCode < \`300\`', which means responses not in range 2xx won't be saved in idempotency.
