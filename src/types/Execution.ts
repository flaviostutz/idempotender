export type Execution = {
    statusOpen(): boolean
    statusLocked(): boolean
    statusCompleted(): boolean
    output(): string | null
    cancel(): Promise<void>
    complete(output:string): Promise<void>
}
