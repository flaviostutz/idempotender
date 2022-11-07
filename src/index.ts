
import jmespath from 'jmespath';

import { Execution } from './types/Execution';
import { Idempotender } from './types/Idempotender';
import { IdempotenderConfig } from './types/IdempotenderConfig';
import { getExecutionStatus, sleep } from './utils';
import { ExecutionStatus } from './types/ExecutionStatus';
import { deleteExecution, fetchExecution, acquireLock, completeExecution } from './db';

const jmespathMapper = (query:string) => {
  return (input:any):string => {
    return jmespath.search(input, query);
  };
};

const defaultConfig:IdempotenderConfig = {
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

  const config1 = { ...config, ...defaultConfig };
  if (!config1.keyMapper && !config1.keyJmespath?.trim()) {
    throw new Error('Config: Either \'keyJmespath\' or a custom \'keyMapper\' function is required');
  }
  if (config1.keyMapper && config1.keyJmespath) {
    throw new Error('Config: If \'keyMapper\' is defined, \'keyJmespath\' shouldn\'t be defined because it won\'t have an effect');
  }

  if (config1.keyJmespath) {
    config1.keyMapper = jmespathMapper(config1.keyJmespath);
  }

  return {
    getExecution: async (key:string):Promise<Execution> => {

      // determine status of execution
      let status = ExecutionStatus.OPEN;
      let lockAcquired = false;
      let executionOutput:string;

      // if cannot get lock, retry until "lockAcquireTimeout" for the lock to be released
      // (check if output saved or if you need to try to acquire a lock again)
      const startTime = new Date().getTime();
      const retryTimeoutMs = config1.lockAcquireTimeout * 1000;
      let st = 500;

      do {
        const executionData = await fetchExecution(key, config1);
        status = getExecutionStatus(executionData);

        if (status === ExecutionStatus.COMPLETED) {
          if (!executionData) { throw new Error('Shouldnt be COMPLETED if executionData is null'); }
          executionOutput = executionData.outputValue;
          break;
        }

        if (status === ExecutionStatus.OPEN) {
          lockAcquired = await acquireLock(key, config1);
          if (lockAcquired) {
            break;
          }
        }

        await sleep(st);
        st *= 2; // 500, 1000, 2000, 4000, 8000, 16000
      } while ((new Date().getTime() - startTime) < retryTimeoutMs);

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
        output():string {
          if (status !== ExecutionStatus.COMPLETED) {
            throw new Error('Cannot get output if execution is not completed');
          }
          return executionOutput;
        },
        cancel: async ():Promise<void> => {
          await deleteExecution(key, config1);
        },
        complete: async (output:string):Promise<void> => {
          await completeExecution(key, output, config1);
        },
      };
    },
    mapKey: (input:any):string => {
      if (!config1.keyMapper) { throw new Error('keyMapper shouldnt be null'); }
      return config1.keyMapper(input);
    },
  };
};

export default idempotender;
