import { Execution } from './Execution';

export interface Idempotender {
  getExecution(key: string): Promise<Execution>;
}
