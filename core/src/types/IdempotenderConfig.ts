import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

/**
 * Idempotender configurations
 */
export type IdempotenderConfig = {

  /**
   * DynamoDB table name used for storing Executions
   * Defaults to 'IdempotencyExecutions'
   */
  dynamoDBTableName?: string;

  /**
   * Optional dynamoDBClient to be used
   */
  dynamoDBClient?: DynamoDBClient;

  /**
   * If enabled, will control a distributed execution lock in DynamoDB
   * so only one process will be able to get a lock
   * and execute the actual idempotent function at a time, regardless
   * of being executed in different servers in parallel.
   * Defaults to true
   */
  lockEnable?: boolean;

  /**
   * Time in seconds until an acquired lock is expired if the
   * calling process doesn't cancel or finishes it so
   * another process can acquire it again
   */
  lockTTL?: number;

  /**
   * Time in seconds in which an execution is valid
   * even after completed, which means, in practice,
   * for how long the idempotency control of a call to
   * a function will be valid
   */
  executionTTL?: number;

  /**
   * Whatever to hash or not the key before storing in the
   * database. Useful with large keys, or keys with sensitive
   * data that you don't want to expose to the database
   */
  keyHash?: boolean;

  /**
   * Time in seconds waiting for an active lock to be
   * released while trying to get a lock
   */
  lockAcquireTimeout?: number;
};
