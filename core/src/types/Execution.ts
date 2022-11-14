import { ExecutionOutput } from './ExecutionOutput';

/**
 * Execution instance used for idempotency control
 */
export type Execution<T> = {

  /**
   * Checks if the status of this execution is "open", which means
   * no one has completed this execution yet and the current process
   * has the necessary locks to do it (and call 'complete(value)' at the end)
   */
  statusOpen(): boolean;

  /**
   * Checks if the status of this execution is "locked", which means
   * another process is already processing this Execution and you shouldn't
   * do it in parallel for now.
   */
  statusLocked(): boolean;

  /**
   * Checks if the status of this execution is "completed", which means
   * this execution was already processed before and you can simply
   * reuse the previous outputs of this previous process by
   * calling 'output()'
   */
  statusCompleted(): boolean;

  /**
   * Gets a previous output of this Execution if it is "completed"
   */
  output(): ExecutionOutput<T>;

  /**
   * Cancels any locks and deletes this execution from database
   * so another process will see this Execution as "open"
   * in the future
   */
  cancel(): Promise<void>;

  /**
   * Stores the output of the actual execution of the function being
   * idempotent in the database so another processes can access it
   * until config.executionTTL
   * @param output
   */
  complete(output: T): Promise<ExecutionOutput<T>>;
};
