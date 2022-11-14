import axios from 'axios';

if (!process.env.BASE_URL) {
  throw new Error('BASE_URL env is required');
}
const baseURL = process.env.BASE_URL;

const axiosOpts = {
  headers: {
    'x-api-key': 'QVWv27iOIP6ik9NjkB2ShaShABeKYHgo4Dw9KzLR',
  },
};

describe('test random number generator', () => {

  it('random number is variable', async () => {
    let resp = await axios.get(`${baseURL}/random/number`, axiosOpts);
    const v1 = resp.data;

    resp = await axios.get(`${baseURL}/random/number`, axiosOpts);
    const v2 = resp.data;

    resp = await axios.get(`${baseURL}/random/number`, axiosOpts);
    const v3 = resp.data;

    expect(v1 !== v2).toBeTruthy();
    expect(v1 !== v3).toBeTruthy();
    expect(v2 !== v3).toBeTruthy();
  });

});
