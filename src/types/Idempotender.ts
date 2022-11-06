import { Execution } from './Execution';

export interface Idempotender {
    getExecution(input:any): Execution
    deleteExecution(input:any): void
    saveExecution(input:any, output:string): void
}
