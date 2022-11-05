# idempotender

A Javascript library for idempotency control based on DynamoDB.

Idempotency is the attribute of a function to be called multiple times with a certain input so the underlying state and the output stays the same as the first execution regardless of how many times the function was called with that input.

It's important, for example, to avoid duplicate execution of payments, or to simplify scenarios where failures can be fixed with simple retries, without risking duplications and inconsistencies.

Idempotender can be used to create this attribute to any function. You can use the library directly in any function, or you can use it as a Middy middleware.

The overall process for idempotency is:

- At the beginning of the function execution, create a key based on input
- If the key exists in a DynamoDB table, it means this execution was already done, so get the previous output and return it to the caller. The caller won't know it wasn't really executed, and will receive the same response as the first client, which is expected.
- If the key doesn't exist, run the actual function behavior and at the end save the output to DynamoDB table before returning it to the caller

## Usage

- `npm install --save idempotender`

```js
import idempotender from 'idempotender';
```

- Create DynamoDB table with structure:

```yml
Resources:
  IdempotencyExecutions:
    Type: AWS::DynamoDB::Table
    Properties:
      AttributeDefinitions:
        - AttributeName: key
          AttributeType: S
        - AttributeName: lockExpiration
          AttributeType: S
        - AttributeName: output
          AttributeType: S
      KeySchema:
        - AttributeName: key
          KeyType: HASH
      TimeToLiveSpecification:
        AttributeName: executionExpiration
        Enabled: true
```

### Example: As Middy middleware in Lambda

- In this example, we will use attribute 'param1' from event as the key of idempotency while hashing and using lock to avoid concurrency

- Create Lambda function

```js
import idempotender from 'idempotender';

const handler = middy((event, context) => {
  console.log(`Running for '${event.param1}' on ${new Date()}`);
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotender({
    dynamoDBTableName: 'Executions',
    keyJmespath: 'param1',
  }),
);
```

### Example: As Middy middleware in Lambda via REST API

- In this example, the Lambda is invoked through AWS API Gateway, so we select attributes 'method', 'path' and request 'body' from event as the key of idempotency.

- The extracted key will then be hashed before being stored in database, so data is not exposed, but you have a very very tiny change of collision (we use hash-256).

- `npm install --save idempotender`

- Create AWS Lambda function exposed through AWS API Gateway

```js
import idempotender from 'idempotender';

const handler = middy((event, context) => {
  console.log('Will only execute this once per idempotence key!');
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotender({
    lockEnable: true,
    lockTTL: 3600,
    executionTTL: 24 * 3600,
    dynamoDBTableName: 'Executions',
    keyJmespath: '[method, path, body]',
  }),
);
```

### Example: As Middy middleware in Lambda (REST API with Idempotency-Key header)

- In this example, the Lambda is invoked through AWS API Gateway, and we will use Stripe style for controlling the idempotency key (header Idempotency-Key). See https://stripe.com/docs/api/idempotent_requests.

- We won't use hash and the quality of the idempotency key is responsability of the caller.

- `npm install --save idempotender`

- Create AWS Lambda function exposed through AWS API Gateway

```js
import idempotender from 'idempotender';

const handler = middy((event, context) => {
  console.log('Will only execute this once per idempotence key!');
  return { message: `This was run for '${event.param1}' on ${new Date()}` };
});

handler.use(
  idempotender({
    lockEnable: true,
    lockTTL: 60,
    executionTTL: 24 * 3600,
    dynamoDBTableName: 'Executions',
    keyJmespath: "[headers['Idempotency-Key']]",
  }),
);
```

### Example: As lib in NodeJS

- In this example, the function calls explicitely the idempotency utility, and will use a custom mapper to transform the input key to the key used in database

- It will deactivate the hashing mechanism, so in the database you can see the actual contents of param1:param2 and there is no chance of collision.

- `npm install --save idempotender`

- Create function

```js
import idempotender from 'idempotender';

const idem = idempotender({
  executionTTL: 24 * 3600,
  dynamoDBTableName: 'Executions',
  keyMapper: (key) => `${key.param1}:${key.param2}`,
  keyHash: false,
});

function myIdempotentFunction(param1: string, param2: string): string {
  // get current idempotency status
  // acquire lock to avoid concurrent calls to this function
  const execution = idem.getExecution({ param1, param2 });
  // already processed before, so return previous output data response
  if (execution.statusSaved()) {
    return execution.output;
  }
  // another process is processing this in parallel
  if (execution.statusLocked()) {
    throw new Error(`Concurrent processing for idempotency key ${execution.key}`);
  }

  // DO BUSINESS HERE
  try {
    console.log(`I only hello world for (${param1},${param2}) once!`);
    const output = `This is output '${param1}${param2}' at ${new Date()}`;
  } catch (err) {
    console.log('Error during function execution');
    idem.deleteExecution(execution.key);
  }

  // save execution output so further calls in the next 24h
  // using the same param1,param2 will return this response
  // without actually running the business function
  idem.saveExecution(execution.key, output);

  return output;
}
```

## Reference

```js
const idem = idempotender({
    dynamoDBTableName: 'IdempotencyExecutions',
    lockEnable: true,
    lockTTL: 60,
    executionTTL: 24 * 3600,
    keyJmespath: 'headers.["Idempotency-Key"]',
    keyMapper: null,
    keyHash: true
}
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

    - Defaults to '60'

  - **executionTTL**

    - Time in seconds after execution is finished in which if another request with the same key arrives, will be responded with the first execution response.

    - The actual execution will be skipped, but the client will receive the same response as in the first call.

    - Defaults to '24 \* 3600'

  - **keyMapper**

    - A function that receives the input data and returns the key used by the idempotency control

    - Defaults to a jmespath data extractor, controlled by option 'keyJmespath'

  - **keyJmespath**

    - jmespath expression used for extracting the database key from input data. Check https://jmespath.org/tutorial.html

    - When using Middy, the input is the lambda 'input' object

    - Required if no custom keyMapper is used. Not used if 'keyMapper' is defined.

  - **keyHash**

    - Whatever hash the key before storing in the database or not

    - Useful in cases where the key is too large or you don't want to expose the input parameters in plain text in DynamoDB

    - This is applied after keyMapper is executed

    - SHA-256 is used, which is very secure, but keep in mind that there is a very low possibility of collisions if this is enabled.

    - Defaults to 'true'

## Functions:

- **saveExecution(key:string, output:string)**

  - Save the output as the execution result for a specific key, so that next time anyone tries to "getExecution(key)" with this key, it will be returned

- **getExecution(input:string):object**

  - Queries the execution table for a certain input. If it doesn't exist and lock is enabled, creates the record for lock control

  - The actual key used in database operations is the result of the 'input' mapped to a key (see config 'keyMapper' and 'keyJmespath') and, if enabled, hashed with SHA-256.

  - Returns an object with struct:

    - **statusSaved():boolean**

      - Returns true if a previous execution with corresponding output data was saved and is available via attribute 'output'

  - **statusLocked():boolean**

    - Returns true if another function started processing this but didn't reached "saveExecution()" still, indicating these two executions might be running in parallel, but only one should be able to actually run

  - **output**: previously saved output, indicating this function was already called before

- **deleteExecution(key:string)**

  - Deletes an execution. Normally used when something goes wrong during the function execution and you want to clear the execution so another call can try to execute the function again later on

## AWS input samples

### AWS API Gateway request

The input for lambda functions called through a AWS API Gateway is as follows. Keep this in mind when creating jmespath selectors.

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
