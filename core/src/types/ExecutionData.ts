import { ExecutionOutput } from './ExecutionOutput';

export type ExecutionData<T> = {
  key: string;
  lockTTL: number;
  executionTTL: number;
  outputSaved: boolean;
  outputValue: ExecutionOutput<T>;
};
