# idempotender core

This is the javascript library with basic functions for implementing a Idempotent function.

It is able to acquire a lock for an execution to prevent concurrency situations, store and retrieves states from DynamoDB between executions based on a key.

## Usage

- `npm install --save @idempotender/core`

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

### Example: Simplest form

- Create function

```js
import { withIdempotency } from '@idempotender/core';

function myIdempotentFunction(param1: string, param2: string): string {

  const out = await withIdempotency(():string => {
    // business logic
    return `First run at ${new Date()}`;
  },
  // idempotency key
  `${param1}:${param2}`);

  return out;
}
```

### Example: Using more advanced options of the API

- It will deactivate the hashing mechanism, so in the database you can see the actual contents of param1:param2 and there is no chance of collision.

- Create function

```js
import idempotender from '@idempotender/core';

const idem = idempotender({
  executionTTL: 24 * 3600,
  dynamoDBTableName: 'IdempotencyExecutions',
  keyHash: false,
});

function myIdempotentFunction(param1: string, param2: string): string {
  // get current idempotency status
  // acquire lock to avoid concurrent calls to this function
  const execution = await idem.getExecution(`${param1}:${param2}`);
  // already processed before, so return previous output data response
  if (execution.statusCompleted()) {
    return execution.output();
  }
  // another process is processing this in parallel
  if (execution.statusLocked()) {
    throw new Error(`Concurrent processing for idempotency key ${execution.key}`);
  }

  // status is "open", so
  // DO BUSINESS HERE
  try {
    console.log(`I only hello world for (${param1},${param2}) once!`);
    const output = `This is output '${param1}${param2}' at ${new Date()}`;
  } catch (err) {
    console.log('Error during function execution');
    idem.cancel(execution.key);
  }

  // save execution output so further calls in the next 24h
  // using the same "param1,param2" as key will return this response
  // without actually running the business function
  idem.complete(execution.key, output);

  return output;
}
```

## Reference

- These are the default values of the configuration

```js
const idem = idempotender({
    dynamoDBTableName: 'IdempotencyExecutions',
    lockEnable: true,
    lockTTL: 10,
    lockRetryTimeout: 15,
    executionTTL: 24 * 3600,
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

    - Defaults to '10'

  - **lockRetryTimeout**

    - Time in seconds waiting for an existing lock to be released in case of concurrency. If the lock is released in this period, we will try to get the last saved output from the other process (if it was saved) and can return the previous output gracefully. If after lock is released and output was not saved, we will try to acquire the lock again.

    - Defaults to '15'

  - **executionTTL**

    - Time in seconds after execution is finished in which if another request with the same key arrives, will be responded with the first execution response.

    - The actual execution will be skipped, but the client will receive the same response as in the first call.

    - Defaults to '24 \* 3600'

  - **keyHash**

    - Whatever hash the key before storing in the database or not

    - Useful in cases where the key is too large or you don't want to expose the input parameters in plain text in DynamoDB

    - This is applied after keyMapper is executed

    - SHA-256 is used, which is very secure, but keep in mind that there is a very low possibility of collisions if this is enabled.

    - Defaults to 'true'

## Functions

- **completeExecution(key:string, output:string)**

  - Save the output as the execution result for a specific key, so that next time anyone tries to "getExecution(key)" with this key, it will be returned

- **getExecution(input:string):object**

  - Queries the execution table for a certain input. If it doesn't exist and lock is enabled, creates the record for lock control

  - The actual key used in database operations is the result of the 'input' mapped to a key (see config 'keyMapper' and 'keyJmespath') and, if enabled, hashed with SHA-256.

  - Returns an object with struct:

    - **statusCompleted():boolean**

      - Returns true if a previous execution with corresponding output data was saved and is available via attribute 'output'

  - **statusLocked():boolean**

    - Returns true if another function started processing this but didn't reached "saveExecution()" still, indicating these two executions might be running in parallel, but only one should be able to actually run

  - **output**: previously saved output, indicating this function was already called before

- **deleteExecution(key:string)**

  - Deletes an execution. Normally used when something goes wrong during the function execution and you want to clear the execution so another call can try to execute the function again later on
