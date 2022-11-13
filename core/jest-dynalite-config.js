module.exports = {
  tables: [
    {
      TableName: `IdempotencyExecutions`,
      KeySchema: [{ AttributeName: 'Id', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'Id', AttributeType: 'S' }],
      ProvisionedThroughput: { ReadCapacityUnits: 1, WriteCapacityUnits: 1 },
    },
  ],
  basePort: 8000,
};
