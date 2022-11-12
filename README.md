# idempotender

TODO

[ ] migrate to Yarn 3
[ ] configure NX
[ ] publish pakages by tagging
[ ] document complete example

JS lib for helping creating idempotent functions by storing states in DynamoDB.

Idempotency is the attribute of a function to be called multiple times with a certain input so the underlying state and the output stays the same as the first execution regardless of how many times the function was called with that input.

You can use it as:

- [Middy Middleware for AWS Lambda functions](middy/README.md)
- [Core library for anything else](core/README.md)

Check the specific documentation for details on how to use it.

We are Typescript friendly :)

## Sample usage for AWS Lambda

- In this example, we will use the header 'Idempotency-Key' from rest request as the key of idempotency (as [Stripe does](https://stripe.com/docs/api/idempotent_requests) in its api)

- `npm install --save idempotender-middy`

- Create AWS Lambda function exposed through AWS API Gateway and use the Middy middlware

```js
import idempotenderMiddy from 'idempotender-middy';

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

- [Middy Middleware for AWS Lambda functions](middy/README.md)
- [Core Idempotender lib](core/README.md)
