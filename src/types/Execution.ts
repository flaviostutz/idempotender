export interface Execution {
    statusLocked(): boolean
    statusPending(): boolean
    statusSaved(): boolean
    output(): string | null
}
