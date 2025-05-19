import { gunzip } from 'node:zlib';

type CloudflareBaseEvent = {
	EventTimestampMs: number;
	Exceptions?: CloudflareEventException[];
	Logs: CloudflareEventLog[];
	Outcome: string;
	ScriptName: string;
	ScriptTags: string[];
	DiagnosticsChannelEvents: TraceDiagnosticChannelEvent[];
	Entrypoint: string;
	ScriptVersion?: {
		ID?: string;
		Message: string;
		Tag?: string;
	};
	DispatchNamespace?: string;
	Truncated: boolean;
	CPUTimeMs: number;
	WallTimeMS: number;
	EventType: string;
};

interface CloudflareHttpEvent extends CloudflareBaseEvent {
	Event: {
		RayID: string;
		Request: {
			URL: string;
			Method: string;
			Headers: Record<string, string>;
			CF: Record<string, unknown>;
		};
		Response: { Status: number };
	};
	EventType: 'fetch';
}

export interface CloudflareScheduledEvent extends CloudflareBaseEvent {
	Event: {
		Cron: string;
		ScheduledTimeMs: number;
	};
	EventType: 'scheduled';
}

interface CloudflareAlarm extends CloudflareBaseEvent {
	Event: {
		ScheduledTimeMs: number;
		ScriptName?: string;
	};
	EventType: 'alarm';
}

interface CloudflareQueueEvent extends CloudflareBaseEvent {
	Event: {
		Queue: string;
		BatchSize: number;
		ScriptName?: string;
	};
	EventType: 'queue';
}

interface CloudflareEmailEvent extends CloudflareBaseEvent {
	Event: {
		MailFrom: string;
		RcptTo: string;
		RawSize: number;
		ScriptName?: string;
	};
	EventType: 'email';
}

interface CloudflareTailEvent extends CloudflareBaseEvent {
	Event: {
		ConsumedEvents: TraceItemTailEventInfo['consumedEvents'];
	};
	EventType: 'tail';
}

interface CloudflareRpcEvent extends CloudflareBaseEvent {
	Event: {
		rpcMethod: string;
	};
	EventType: 'rpc';
}

type CloudflareEventException = {
	Name: string;
	Message: string;
	TimestampMs: number;
	Stack?: string;
};

export type LogLevel = 'unknown' | 'debug' | 'info' | 'log' | 'warn' | 'error';

type CloudflareEventLog = {
	Level: LogLevel;
	Message: string[];
	TimestampMs: number;
};

export type CloudflareLogPushEventStronglyTyped =
	| CloudflareHttpEvent
	| CloudflareScheduledEvent
	| CloudflareAlarm
	| CloudflareQueueEvent
	| CloudflareEmailEvent
	| CloudflareRpcEvent
	| CloudflareTailEvent;

export type CloudflareLogPushEvent = CloudflareLogPushEventStronglyTyped | CloudflareBaseEvent;

export async function logpushEventsFromRequest(
	request: Request,
): Promise<Record<string, CloudflareLogPushEvent[]>> {
	if (
		!request.headers.has('Content-Encoding') ||
		request.headers.get('Content-Encoding') !== 'gzip'
	) {
		throw new Error('Invalid Content-Encoding header');
	}

	const body = await request.bytes();
	const decompressedBody = await new Promise<Buffer>((resolve, reject) => {
		gunzip(body, (err, data) => {
			if (err) {
				reject(err);
			} else {
				resolve(data);
			}
		});
	});

	const bodyText = new TextDecoder().decode(decompressedBody);

	// When creating a new Logpush job, Cloudflare will send a test event to the destination
	// to ensure the destination is reachable. We'll return an empty object to ingest no logs.
	if (bodyText === '{"content":"test"}') {
		return {};
	}

	const events: CloudflareLogPushEvent[] = bodyText
		.split('\n')
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line));
	const groupedEvents: Record<string, CloudflareLogPushEvent[]> = {};
	for (const event of events) {
		const eventsForGroup = groupedEvents[event.ScriptName] || [];
		groupedEvents[event.ScriptName] = [...eventsForGroup, event];
	}

	return groupedEvents;
}

export function isOfKnownType(
	event: CloudflareLogPushEvent,
): event is CloudflareLogPushEventStronglyTyped {
	return 'EventType' in event;
}
