import middy from '@middy/core';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { setDynamoDBClient } from 'idempotender-core';

describe('When using default configurations', () => {
  beforeAll(() => {
    beforeAll(async () => {
      const ddbclient = new DynamoDBClient({
        endpoint: 'http://localhost:8000',
        region: 'local-env',
      });
      setDynamoDBClient(ddbclient);
      // await deleteExecution('333', config);
    });
  });

  it('Jmespath mapper should work', () => {
    const handler = middy(() => {});
    handler
      .use(
        idempotenderMiddy({
        }),
      )
      .before(async (request) => {
      });

    await handler(event, context);
  });
});

// import idempotenderMiddy from './index';

// it('map key with custom mapper should work', () => {
//   const idem = idempotenderMiddy({ keyMapper: (vv) => vv.key1.key2 });
//   const res = idem.mapKey({ key1: { key2: 'value1' } });
//   expect(res).toEqual('value1');
// });

// it('map key with embedded jmespath should work', () => {
//   const idem = idempotenderMiddy({ keyJmespath: 'key1' });
//   const res = idem.mapKey({ key1: 'value1' });
//   expect(res).toEqual('value1');
// });

// it('map key with embedded jmespath should work 2', () => {
//   const idem = idempotenderMiddy({ keyJmespath: 'key1.key2[1]' });
//   const res = idem.mapKey({ key1: { key2: ['test1', 'test2', 'test3'] } });
//   expect(res).toEqual('test2');
// });
