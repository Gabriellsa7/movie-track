import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { format, LoggerTraceability } from 'traceability';

export const otelTraceContextFormat = format((info) => {
  const spanContext = trace.getSpanContext(context.active());
  if (spanContext && isSpanContextValid(spanContext)) {
    info.trace_id = spanContext.traceId;
    info.span_id = spanContext.spanId;
    info.trace_flags = `0${spanContext.traceFlags.toString(16)}`;
  }
  return info;
});

export function configureLoggerTraceContext(): void {
  const baseOptions = LoggerTraceability.getLoggerOptions();
  LoggerTraceability.configure({
    ...baseOptions,
    format: format.combine(otelTraceContextFormat(), baseOptions.format!),
  });
}
