# idempotender
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fflaviostutz%2Fidempotender.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fflaviostutz%2Fidempotender?ref=badge_shield)

TODO

- [X] migrate to Yarn 3
- [X] configure NX
- [X] use dynalite for dynamodb testing
- [X] publish pakages by tagging
- [ ] create "withIdempotency" utility function
- [ ] document complete example

JS lib for helping creating idempotent functions by storing states in DynamoDB.

Idempotency is the attribute of a function to be called multiple times with a certain input so the underlying state and the output stays the same as the first execution regardless of how many times the function was called with that input.

You can use it as:

- [Middy Middleware for AWS Lambda functions](middy/README.md)
- [Core library for anything else](core/README.md)

Check the specific documentation for details on how to use it.

We are Typescript friendly :)

## Sample usage for AWS Lambda

- In this example, we will use the header 'Idempotency-Key' from rest request as the key of idempotency (as [Stripe does](https://stripe.com/docs/api/idempotent_requests) in its api)

- `npm install --save @idempotender/middy`

- Create AWS Lambda function exposed through AWS API Gateway and use the Middy middlware

```js
import idempotenderMiddy from '@idempotender/middy';

const handler = middy((event, context) => {
  console.log('Will only execute this once per idempotence key!');
  return { message: `This was run on ${new Date()}` };
});

handler.use(
  idempotenderMiddy({
    keyJmespath: "[headers['Idempotency-Key']]",
  }),
);
```

## References

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

  - **lockRetryTimeout**

    - Time in seconds waiting for an existing lock to be released in case of concurrency. If the lock is released in this period, we will try to get the last saved output from the other process (if it was saved) and can return the previous output gracefully. If after lock is released and output was not saved, we will try to acquire the lock again.

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

    - When using Middy, the input is the lambda 'input' object

    - Required if no custom keyMapper is used. Not used if 'keyMapper' is defined.

  - **keyHash**

    - Whatever hash the key before storing in the database or not

    - Useful in cases where the key is too large or you don't want to expose the input parameters in plain text in DynamoDB

    - This is applied after keyMapper is executed

    - SHA-256 is used, which is very secure, but keep in mind that there is a very low possibility of collisions if this is enabled.

    - Defaults to 'true'

## Functions

- **mapKey(input:any)**

  - Converts an arbitrary input data to the key used in database operations to identify this idempotent execution

  - If a custom 'keyMapper' function is set, it will use this function to do the conversion

  - If 'keyJmespath' is set, 'input' must be an object and the results of the jmespath query against this object will be used as the key

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

## Specific documentation

- [Middy Middleware for AWS Lambda functions](middy/README.md)
- [Core Idempotender lib](core/README.md)

## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fflaviostutz%2Fidempotender.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fflaviostutz%2Fidempotender?ref=badge_large)
