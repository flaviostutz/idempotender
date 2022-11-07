import { KeyMapperFunction } from './KeyMapperFunction';

export type IdempotenderConfig = {
  dynamoDBTableName?: string;
  lockEnable?: boolean;
  lockTTL?: number;
  executionTTL?: number;
  keyJmespath?: string | null;
  keyMapper?: KeyMapperFunction | null;
  keyHash?: boolean;
  lockAcquireTimeout?: number;
};
