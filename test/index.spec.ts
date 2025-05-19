import { describe, it, expect } from 'vitest';
import worker from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('worker', () => {
	it('should require a gzip-encoded body', async () => {
		const request = new IncomingRequest('https://example.com/', {
			headers: { 'Content-Encoding': 'identity' },
			method: 'POST',
		});

		const response = await worker.fetch(request);
		expect(response.status).toBe(400);
	});
});
