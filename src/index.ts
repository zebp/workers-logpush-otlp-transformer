import { logpushEventsFromRequest } from './logpush';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { processCloudflareLogpushEvent } from './otel/conversion';
import { OTLPLogExporter } from './otel/otlp-log-exporter';
import { Hono } from 'hono';
import { loadConfigFromEnv } from './config';
import { resourceFromAttributes } from '@opentelemetry/resources';

const config = loadConfigFromEnv();
const app = new Hono();

app.post('/', async (c) => {
	if (
		config.authorization !== undefined &&
		c.req.header('Authorization') !== config.authorization
	) {
		return Response.json({ error: 'Invalid Authorization header' }, { status: 401 });
	}

	if (c.req.header('Content-Encoding') !== 'gzip') {
		return Response.json({ error: 'Invalid Content-Encoding header' }, { status: 400 });
	}

	const groupedEvents = await logpushEventsFromRequest(c.req.raw);

	const logExporter = new OTLPLogExporter({
		url: config.destination,
		headers: config.headers,
	});

	const loggerProviders = Object.fromEntries(
		Object.keys(groupedEvents).map((scriptName) => [
			scriptName,
			new LoggerProvider({
				resource: resourceFromAttributes({
					'cloud.provider': 'cloudflare',
					'cloud.platform': 'cloudflare.workers',
					'cloud.region': 'earth',
					'telemetry.sdk.language': 'js',
					'telemetry.sdk.name': 'cloudflare-otel-logpush',
					'service.name': scriptName ?? 'unknown',
				}),
				processors: [new BatchLogRecordProcessor(logExporter)],
			}),
		]),
	);

	for (const [scriptName, events] of Object.entries(groupedEvents)) {
		const logger = loggerProviders[scriptName].getLogger('cloudflare-otel-logpush');
		for (const event of events) {
			processCloudflareLogpushEvent(event, logger);
		}
	}

	await Promise.all(Object.values(loggerProviders).map((provider) => provider.shutdown()));

	return new Response('ingested');
});

export default app;
