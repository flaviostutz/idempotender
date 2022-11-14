import { sum } from './calc';

describe('test sum', () => {

  it('fail when sum is wrong', () => {
    expect(sum(1, 1)).toEqual(2);
  });
});
