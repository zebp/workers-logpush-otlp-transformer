import { AnyValueMap, LogBody, Logger, SeverityNumber } from '@opentelemetry/api-logs';
import { isOfKnownType, LogLevel, type CloudflareLogPushEvent } from '../logpush';
import { hrTime, millisToHrTime } from '@opentelemetry/core';

const severityMap: Record<LogLevel, SeverityNumber> = {
	debug: SeverityNumber.DEBUG,
	info: SeverityNumber.INFO,
	log: SeverityNumber.INFO,
	warn: SeverityNumber.WARN,
	error: SeverityNumber.ERROR,
	unknown: SeverityNumber.UNSPECIFIED,
};

export function processCloudflareLogpushEvent(event: CloudflareLogPushEvent, logger: Logger) {
	const attributes = eventToAttributes(event);

	for (const log of event.Logs) {
		const message = parseConsoleLogArgsToObject(log.Message);
		const parsedMessage = tryParseMessage(message ?? '');
		logger.emit({
			timestamp: millisToHrTime(log.TimestampMs),
			observedTimestamp: hrTime(Date.now()),
			severityText: log.Level,
			severityNumber: severityMap[log.Level],
			body: parsedMessage,
			attributes,
		});
	}

	for (const exception of event.Exceptions ?? []) {
		logger.emit({
			timestamp: millisToHrTime(exception.TimestampMs),
			observedTimestamp: hrTime(Date.now()),
			severityText: 'error',
			severityNumber: SeverityNumber.ERROR,
			body: {
				display: `Uncaught ${exception.Name}: ${exception.Message}`,
				name: exception.Name,
				message: exception.Message,
				stack: exception.Stack,
			},
			attributes,
		});
	}
}

function eventToAttributes(event: CloudflareLogPushEvent) {
	const baseAttributes = {
		'cloud.provider': 'cloudflare',
		'cloud.platform': 'cloudflare.workers',
		'cloud.region': 'earth',
		'telemetry.sdk.language': 'js',
		'telemetry.sdk.name': 'cloudflare-otel-logpush',
		'service.name': event.ScriptName ?? 'unknown',
	};

	if (!isOfKnownType(event)) {
		return baseAttributes;
	}

	switch (event.EventType) {
		case 'fetch': {
			const { Request, RayID, Response } = event.Event;
			return {
				'http.request.method': Request.Method,
				'url.full': Request.URL,
				'http.response.status_code': Response?.Status,
				'cloudflare.ray_id': RayID,
				...baseAttributes,
			};
		}
		default: {
			return { ...baseAttributes };
		}
	}
}

function parseConsoleLogArgsToObject(args: unknown[]): unknown {
	if (args.length === 0) {
		return '';
	}

	if (args.length === 1) {
		return args[0];
	}

	if (args.length === 2) {
		const [first, second] = args;

		if (typeof first === 'string' && typeof second === 'object') {
			return { message: first, ...second };
		}

		if (typeof first === 'object' && typeof second === 'string') {
			return { message: second, ...first };
		}
	}

	return args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' ');
}

function tryParseMessage(message: unknown): LogBody {
	if (typeof message === 'string') {
		try {
			return JSON.parse(message);
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
		} catch (_error) {
			return message;
		}
	}

	if (typeof message === 'number' || typeof message === 'boolean') {
		return message;
	}

	return message as AnyValueMap;
}
