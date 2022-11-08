import jmespath from 'jmespath';

import { fetchExecution, lockAcquire, deleteExecution, completeExecution } from './db';
import { Execution } from './types/Execution';
import { ExecutionStatus } from './types/ExecutionStatus';
import { Idempotender } from './types/Idempotender';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { getExecutionStatus, sleep } from './utils';

const jmespathMapper = (query: string) => {
  return (input: any): string => {
    return jmespath.search(input, query);
  };
};

const defaultConfig: IdempotenderConfig = {
  dynamoDBTableName: 'IdempotencyExecutions',
  lockEnable: true,
  lockTTL: 60,
  executionTTL: 24 * 3600,
  keyJmespath: null,
  keyMapper: null,
  keyHash: true,
  lockAcquireTimeout: 10,
};

/**
 * Configure Idempotender
 * @param config Configuration parameters
 */
const idempotender = (config:IdempotenderConfig):Idempotender => {
  const config1 = { ...defaultConfig, ...config };
  if (!config1.keyMapper && !config1.keyJmespath?.trim()) {
    throw new Error("Config: Either 'keyJmespath' or a custom 'keyMapper' function is required in configuration object");
  }
  if (config1.keyMapper && config1.keyJmespath) {
    throw new Error(
        "Config: If 'keyMapper' is defined, 'keyJmespath' shouldn't be defined because it won't have an effect",
      );
  }
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
    throw new Error('Config: lockTTL shouldn\'t be greater than executionTTL');
  }
  if (config1.lockAcquireTimeout > config1.lockTTL) {
    throw new Error('Config: lockAcquireTimeout shouldn\'t be greater than lockTTL');
  }

  if (config1.keyJmespath) {
    config1.keyMapper = jmespathMapper(config1.keyJmespath);
  }

  return {
    getExecution: async (key: string): Promise<Execution> => {
          // determine status of execution
      let status = ExecutionStatus.OPEN;
      let lockAcquired = false;
      let executionOutput: string;

          // if cannot get lock, retry until "lockAcquireTimeout" for the lock to be released
          // (check if output saved or if you need to try to acquire a lock again)
      const startTime = new Date().getTime();
      if (!config1.lockAcquireTimeout) {
        throw new Error('lockAcquireTimeout should be present in config');
      }
      const retryTimeoutMs = config1.lockAcquireTimeout * 1000;
      let st = 500;

      do {
        const executionData = await fetchExecution(key, config1);
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
          lockAcquired = await lockAcquire(key, config1);
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
        output(): string {
          if (status !== ExecutionStatus.COMPLETED) {
            throw new Error('Cannot get output if execution is not completed');
          }
          return executionOutput;
        },
        cancel: async (): Promise<void> => {
          await deleteExecution(key, config1);
        },
        complete: async (output: string): Promise<void> => {
          await completeExecution(key, output, config1);
          // if this instance is still used it has the "write through" state
          status = ExecutionStatus.COMPLETED;
          executionOutput = output;
        },
      };
    },
    mapKey: (input: any): string => {
      if (!config1.keyMapper) {
        throw new Error('keyMapper shouldnt be null');
      }
      return config1.keyMapper(input);
    },
  };

};

export { idempotender };
