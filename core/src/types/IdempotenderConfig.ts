export type IdempotenderConfig = {
  dynamoDBTableName?: string;
  lockEnable?: boolean;
  lockTTL?: number;
  executionTTL?: number;
  keyHash?: boolean;
  lockAcquireTimeout?: number;
};
