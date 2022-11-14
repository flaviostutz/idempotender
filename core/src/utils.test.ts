import { ExecutionStatus } from './types/ExecutionStatus';
import { getExecutionStatus, sleep } from './utils';

describe('utils', () => {
  it('status locked', () => {
    expect(
      getExecutionStatus({
        key: 'aaa',
        executionTTL: nowEpoch() + 1000,
        lockTTL: nowEpoch() + 100,
        outputSaved: false,
        outputValue: '',
      }),
    ).toBe(ExecutionStatus.LOCKED);
  });

  it('status open if execution is expired', () => {
    expect(
      getExecutionStatus({
        key: 'aaa',
        executionTTL: nowEpoch() - 1000,
        lockTTL: nowEpoch() - 100,
        outputSaved: false,
        outputValue: '',
      }),
    ).toBe(ExecutionStatus.OPEN);
  });

  it('status open if execution not locked and without saved', () => {
    expect(
      getExecutionStatus({
        key: 'aaa',
        executionTTL: nowEpoch() + 1000,
        lockTTL: 0,
        outputSaved: false,
        outputValue: '',
      }),
    ).toBe(ExecutionStatus.OPEN);
  });

  it('status completed if execution output saved and still valid', () => {
    expect(
      getExecutionStatus({
        key: 'aaa',
        executionTTL: nowEpoch() + 1000,
        lockTTL: 0,
        outputSaved: true,
        outputValue: '',
      }),
    ).toBe(ExecutionStatus.COMPLETED);
  });

  it('status open if lock expired', async () => {
    const ex = {
      key: 'aaa',
      executionTTL: nowEpoch() + 1000,
      lockTTL: nowEpoch() + 0.5,
      outputSaved: false,
      outputValue: '',
    };
    expect(getExecutionStatus(ex)).toBe(ExecutionStatus.LOCKED);
    await sleep(600);
    expect(getExecutionStatus(ex)).toBe(ExecutionStatus.OPEN);
  });

  it('status open if execution expired', async () => {
    const ex = {
      key: 'aaa',
      executionTTL: nowEpoch() + 0.5,
      lockTTL: 0,
      outputSaved: true,
      outputValue: 'bbb',
    };
    expect(getExecutionStatus(ex)).toBe(ExecutionStatus.COMPLETED);
    await sleep(600);
    expect(getExecutionStatus(ex)).toBe(ExecutionStatus.OPEN);
  });
});

const nowEpoch = (): number => {
  return new Date().getTime() / 1000.0;
};
