import { startServer } from '../api';
import axios from 'axios';

describe('API Server', () => {
  let server: any;

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should export startServer function', () => {
    expect(typeof startServer).toBe('function');
  });

  it('should start server on specified port', async () => {
    server = startServer(3456);

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 100));

    const response = await axios.get('http://localhost:3456/api/health');
    expect(response.data.status).toBe('ok');
  });
});
