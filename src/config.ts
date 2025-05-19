export function loadConfigFromEnv() {
	const { DESTINATION } = process.env;
	if (!DESTINATION) {
		throw new Error('Missing DESTINATION environment variable');
	}

	const headers: Record<string, string> = {};

	const headerPrefix = 'DESTINATION_HEADER_';
	for (const key in process.env) {
		if (key.startsWith(headerPrefix)) {
			const headerName = key.substring(headerPrefix.length);
			headers[headerName] = process.env[key]!;
		}
	}

	return {
		destination: DESTINATION,
		authorization: process.env.AUTHORIZATION,
		headers,
	};
}
