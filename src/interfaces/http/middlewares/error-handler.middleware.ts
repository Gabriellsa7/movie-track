import { ErrorRequestHandler } from 'express';
import { Logger } from 'traceability';
import { toErrorResponse } from './error-response.mapper';

const SERVICE_UNAVAILABLE = 503;
const FIRST_SERVER_ERROR = 500;
const FIRST_CLIENT_ERROR = 400;

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: unknown,
  req,
  res,
  next,
) => {
  const response = toErrorResponse(err);

  if (response.status >= FIRST_SERVER_ERROR) {
    const error = err instanceof Error ? err : new Error(String(err));
    Logger.error(error.message, {
      eventName:
        response.status === SERVICE_UNAVAILABLE
          ? 'server.dependency_unavailable'
          : 'server.error',
      status: response.status,
      code: response.code,
      method: req.method,
      path: req.path,
      stack: error.stack,
    });
  } else if (response.status >= FIRST_CLIENT_ERROR) {
    // Only codes and field names are logged, never the request body (it may carry passwords).
    Logger.warn(response.message, {
      eventName: 'http.client_error',
      status: response.status,
      code: response.code,
      method: req.method,
      path: req.path,
      fieldErrors: response.errors,
    });
  }

  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(response.status).json(response);
};
