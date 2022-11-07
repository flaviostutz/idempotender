import { Execution } from './Execution';

export interface Idempotender {
    mapKey(input:any):string
    getExecution(key:string): Promise<Execution>
}
