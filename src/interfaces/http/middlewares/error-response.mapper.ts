import mongoose from 'mongoose';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import { DomainError } from '../../../domain/errors/domain.error';

export interface IFieldError {
  field: string;
  message: string;
}

export interface IErrorResponse {
  message: string;
  status: number;
  code: string;
  errors?: IFieldError[];
}

const INTERNAL_ERROR: IErrorResponse = {
  message: 'Internal Server Error',
  status: 500,
  code: 'INTERNAL_ERROR',
};

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  406: 'NOT_ACCEPTABLE',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  503: 'SERVICE_UNAVAILABLE',
};

const OPENAPI_ERRORS: Record<number, { message?: string; code: string }> = {
  400: { message: 'Validation failed', code: 'VALIDATION_ERROR' },
  401: { code: 'INVALID_TOKEN' },
  404: { message: 'Route not found', code: 'ROUTE_NOT_FOUND' },
};

const BODY_PARSER_ERRORS: Record<string, { message: string; code: string }> = {
  'entity.parse.failed': { message: 'Malformed JSON body', code: 'INVALID_JSON' },
  'entity.too.large': {
    message: 'Request body too large',
    code: 'PAYLOAD_TOO_LARGE',
  },
  'encoding.unsupported': {
    message: 'Unsupported content encoding',
    code: 'UNSUPPORTED_MEDIA_TYPE',
  },
  'charset.unsupported': {
    message: 'Unsupported charset',
    code: 'UNSUPPORTED_MEDIA_TYPE',
  },
  'request.aborted': { message: 'Request aborted', code: 'REQUEST_ABORTED' },
};

const DATABASE_UNAVAILABLE_ERRORS = [
  mongoose.mongo.MongoServerSelectionError,
  mongoose.mongo.MongoNetworkError,
  mongoose.mongo.MongoNotConnectedError,
  mongoose.Error.MongooseServerSelectionError,
];

const MONGO_DUPLICATE_KEY = 11000;
const REQUEST_LOCATION_PREFIX = /^[./]?(body|query|path|params|headers)[./]/;

interface IClientHttpError extends Error {
  status: number;
  type?: string;
}

function codeFor(status: number): string {
  return CODE_BY_STATUS[status] ?? (status < 500 ? 'BAD_REQUEST' : 'INTERNAL_ERROR');
}

function isClientHttpError(err: unknown): err is IClientHttpError {
  const status = (err as Partial<IClientHttpError>)?.status;
  return (
    err instanceof Error &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  );
}

function fromOpenApiError(err: HttpError): IErrorResponse {
  if (err.status >= 500) {
    return INTERNAL_ERROR;
  }
  const known = OPENAPI_ERRORS[err.status];
  const fieldErrors = err.errors
    .filter((error) => REQUEST_LOCATION_PREFIX.test(error.path))
    .map((error) => ({
      field: error.path.replace(REQUEST_LOCATION_PREFIX, ''),
      message: error.message,
    }));
  return {
    message: known?.message ?? err.message,
    status: err.status,
    code: known?.code ?? codeFor(err.status),
    ...(fieldErrors.length > 0 && { errors: fieldErrors }),
  };
}

function fromDatabaseError(err: Error): IErrorResponse | undefined {
  if (
    err instanceof mongoose.mongo.MongoServerError &&
    err.code === MONGO_DUPLICATE_KEY
  ) {
    return {
      message: 'Resource already exists',
      status: 409,
      code: 'DUPLICATE_KEY',
      errors: Object.keys(err.keyPattern ?? {}).map((field) => ({
        field,
        message: 'already exists',
      })),
    };
  }
  if (err instanceof mongoose.Error.CastError) {
    return {
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: err.path, message: `should be a valid ${err.kind}` }],
    };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: Object.values(err.errors).map((error) => ({
        field: error.path,
        message: error.message,
      })),
    };
  }
  const unavailable =
    DATABASE_UNAVAILABLE_ERRORS.some((ErrorClass) => err instanceof ErrorClass) ||
    (err instanceof mongoose.Error && /buffering timed out/.test(err.message));
  if (unavailable) {
    return {
      message: 'Service temporarily unavailable',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    };
  }
  return undefined;
}

export function toErrorResponse(err: unknown): IErrorResponse {
  if (err instanceof DomainError) {
    return {
      message: err.message,
      status: err.status,
      code: err.code ?? codeFor(err.status),
    };
  }
  if (err instanceof HttpError) {
    return fromOpenApiError(err);
  }
  if (isClientHttpError(err)) {
    const known = err.type ? BODY_PARSER_ERRORS[err.type] : undefined;
    return {
      message: known?.message ?? err.message,
      status: err.status,
      code: known?.code ?? codeFor(err.status),
    };
  }
  if (err instanceof Error) {
    return fromDatabaseError(err) ?? INTERNAL_ERROR;
  }
  return INTERNAL_ERROR;
}
