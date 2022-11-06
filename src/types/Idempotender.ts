import { Execution } from './Execution';

export interface Idempotender {
    mapKey(input:any):string
    getExecution(key:string): Execution
    deleteExecution(key:string): void
    saveExecution(key:string, output:string): void
}
