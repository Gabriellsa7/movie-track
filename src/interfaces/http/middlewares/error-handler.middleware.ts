import { ErrorRequestHandler } from 'express';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import { Logger } from 'traceability';
import { DomainError } from '../../../domain/errors/domain.error';

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: Error,
  _req,
  res,
  _next,
) => {
  if (err instanceof DomainError) {
    res.status(err.status).json({
      message: err.message,
      status: err.status,
      ...(err.code && { code: err.code }),
    });
    return;
  }
  if (err instanceof HttpError) {
    if (err.status >= 500) {
      Logger.error(err.message, {
        eventName: 'server.http_error',
        status: err.status,
        errors: err.errors,
      });
    }
    res.status(err.status).json({
      message: err.message,
      status: err.status,
      errors: err.errors,
    });
    return;
  }
  Logger.error(err.message, {
    eventName: 'server.error',
    stack: err.stack,
  });
  res.status(500).json({
    message: 'Internal Server Error',
    status: 500,
  });
};
