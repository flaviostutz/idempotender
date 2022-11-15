import crypto from 'crypto';

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import { fetchExecution, lockAcquire, deleteExecution, completeExecution } from './db';
import { Execution } from './types/Execution';
import { ExecutionOutput } from './types/ExecutionOutput';
import { ExecutionStatus } from './types/ExecutionStatus';
import { Idempotender } from './types/Idempotender';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { getExecutionStatus, sleep } from './utils';

const defaultConfig: IdempotenderConfig = {
  dynamoDBTableName: 'IdempotencyExecutions',
  lockEnable: true,
  lockTTL: 60,
  executionTTL: 24 * 3600,
  keyHash: true,
  lockAcquireTimeout: 10,
  dynamoDBClient: new DynamoDBClient({}),
};

/**
 * Call this function passing config to start using Idempotender.
 * Pass a generics type while calling the function to type the
 * execution output for your specific case
 * @param config Configuration parameters
 */
const core = <T>(config: IdempotenderConfig): Idempotender<T> => {
  const config1 = { ...defaultConfig, ...config };
  if (!config1.lockTTL) {
    throw new Error('Config: lockTTL is required');
  }
  if (!config1.executionTTL) {
    throw new Error('Config: executionTTL is required');
  }
  if (!config1.lockAcquireTimeout) {
    throw new Error('Config: lockAcquireTimeout is required');
  }

  if (config1.lockTTL > config1.executionTTL) {
    throw new Error("Config: lockTTL shouldn't be greater than executionTTL");
  }
  if (config1.lockAcquireTimeout > config1.lockTTL) {
    throw new Error("Config: lockAcquireTimeout shouldn't be greater than lockTTL");
  }

  return {
    getExecution: async (key: string): Promise<Execution<T>> => {
      if (!key || typeof key !== 'string' || key.length <= 3) {
        throw new Error(`The key used for idempotency must be a string with len>3. key='${key}'`);
      }

      let dbKey = key;

      if (config1.keyHash) {
        const hash = crypto.createHash('sha512');
        const data = hash.update(key, 'utf-8');
        dbKey = data.digest('hex');
      }

      // determine status of execution
      let status = ExecutionStatus.OPEN;
      let lockAcquired = false;
      let executionOutput: ExecutionOutput<T> | null;

      // if cannot get lock, retry until "lockAcquireTimeout" for the lock to be released
      // (check if output saved or if you need to try to acquire a lock again)
      const startTime = new Date().getTime();
      if (!config1.lockAcquireTimeout) {
        throw new Error('lockAcquireTimeout should be present in config');
      }
      const retryTimeoutMs = config1.lockAcquireTimeout * 1000;
      let st = 500;

      do {
        const executionData = await fetchExecution<T>(dbKey, config1);
        status = getExecutionStatus(executionData);

        if (status === ExecutionStatus.COMPLETED) {
          if (!executionData) {
            throw new Error('Shouldnt be COMPLETED if executionData is null');
          }
          executionOutput = executionData.outputValue;
          break;
        }

        // skip lock acquire
        if (!config1.lockEnable) {
          break;
        }

        if (status === ExecutionStatus.OPEN) {
          lockAcquired = await lockAcquire(dbKey, config1);
          if (lockAcquired) {
            break;
          }
        }

        await sleep(st);
        st *= 2; // exponential backoff. ex: 500, 1000, 2000, 4000, 8000, 16000
      } while (new Date().getTime() - startTime < retryTimeoutMs);

      return {
        statusOpen(): boolean {
          return status === ExecutionStatus.OPEN;
        },
        statusLocked(): boolean {
          return status === ExecutionStatus.LOCKED;
        },
        statusCompleted(): boolean {
          return status === ExecutionStatus.COMPLETED;
        },
        output(): ExecutionOutput<T> {
          if (status !== ExecutionStatus.COMPLETED || executionOutput == null) {
            throw new Error('Cannot get output if execution is not completed');
          }
          return executionOutput;
        },
        cancel: async (): Promise<void> => {
          await deleteExecution(dbKey, config1);
          status = ExecutionStatus.OPEN;
          executionOutput = null;
        },
        complete: async (output: T): Promise<ExecutionOutput<T>> => {
          const execOutput = await completeExecution<T>(dbKey, output, config1);
          // if this instance is still used it has the "write through" state
          status = ExecutionStatus.COMPLETED;
          executionOutput = execOutput;
          return executionOutput;
        },
      };
    },
  };
};

export { core };
