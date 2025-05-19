import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { LogRecordExporter, ReadableLogRecord } from '@opentelemetry/sdk-logs';
import { JsonLogsSerializer } from '@opentelemetry/otlp-transformer';
export interface OTLPLogExporterOptions {
	url: string;
	headers: Record<string, string>;
}

export class OTLPLogExporter implements LogRecordExporter {
	#options: OTLPLogExporterOptions;
	#promises: Promise<void>[] = [];

	constructor(options: OTLPLogExporterOptions) {
		this.#options = options;
	}

	export(logs: ReadableLogRecord[], resultCallback: (result: ExportResult) => void): void {
		const serializedJsonLogs: Uint8Array | undefined = JsonLogsSerializer.serializeRequest(logs);

		if (serializedJsonLogs) {
			const requestPromise = fetch(this.#options.url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...this.#options.headers,
				},
				body: serializedJsonLogs,
			})
				.then(async (resp) => {
					if (resp.ok) {
						return resultCallback({ code: ExportResultCode.SUCCESS });
					}

					return resultCallback({
						code: ExportResultCode.FAILED,
						error: new Error(resp.statusText),
					});
				})
				.catch((err) => resultCallback({ code: ExportResultCode.FAILED, error: err }));

			this.#promises.push(requestPromise);
		} else {
			resultCallback({ code: ExportResultCode.FAILED, error: new Error('No serialized logs') });
		}
	}

	async shutdown(): Promise<void> {
		await Promise.allSettled(this.#promises);
	}
}
