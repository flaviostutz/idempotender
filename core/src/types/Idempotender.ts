import { Execution } from './Execution';

export interface Idempotender<T> {

  /**
   * Tries to get an existing Execution in database identified by "key".
   * If it doesn't exist, create it with status "open" and create a lock for this process.
   * If it already exists, and is "completed", return immediatelly.
   * If it already exists, but is locked (another process might be handling the same key),
   * wait until config.lockAcquireTimeout tring to get an unlocked instance. After timeout
   * it can still be in status "locked".
   * @param key Key that uniquely identifies this execution
   */
  getExecution(key: string): Promise<Execution<T>>;
}
