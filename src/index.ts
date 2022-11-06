import jmespath from 'jmespath';

import { Execution } from './types/Execution';
import { Idempotender } from './types/Idempotender';
import { IdempotenderConfig } from './types/IdempotenderConfig';


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
    getExecution: (key:string):Execution => {

      // FIXME WHILE (inside lockRetryTimeout)

      // FIXME get execution
      // if doesn't exist, not saved, or execution expired, acquire lock
      // else return last output

      // FIXME acquire write lock
      // put lockTTL=[date in future] with condition lockTTL==0
      // if cannot get lock, retry until "lockTimeout" for the lock to be released
      // (check if output saved or if you need to try to acquire a lock again)
      // backoffTime=500ms; backoffRatio=2
      // 500, 1000, 2000, 4000, 8000, 16000

      const execution = {
        executionTTL: 123,
        lockTTL: 123,
        outputSaved: false,
        outputData: '',
      };

      const nowEpoch = new Date().getTime() / 1000.0;

      return {
        statusLocked(): boolean {
          if (this.statusSaved() || !config1.lockEnable) {
            return false;
          }
          return nowEpoch < execution.lockTTL;
        },
        statusPending(): boolean {
          return !this.statusLocked() && !this.statusSaved();
        },
        statusSaved(): boolean {
          if (execution.outputSaved) {
            return nowEpoch < execution.executionTTL;
          }
          return false;
        },
        output():string {
          if (!this.statusSaved()) {
            throw new Error('Cannot get output if status is not "saved"');
          }
          return execution.outputData;
        },
      };
    },
    deleteExecution: (key:string):void => {
    },
    saveExecution: (key:string, output:string):void => {
    },
    mapKey: (input:any):string => {
      //FIXME 
      return JSON.stringify(input);
    },
  };

};

export const idempotender;
