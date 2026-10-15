import mongoose from 'mongoose';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import { NextFunction, Request, Response } from 'express';
import { Logger } from 'traceability';
import { toErrorResponse } from '../../interfaces/http/middlewares/error-response.mapper';
import { errorHandlerMiddleware } from '../../interfaces/http/middlewares/error-handler.middleware';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { DomainError } from '../../domain/errors/domain.error';

function clientHttpError(status: number, message: string, type?: string) {
  return Object.assign(new Error(message), { status, type, expose: true });
}

describe('When we map a domain error', () => {
  it('should keep its status, message and code', () => {
    expect(
      toErrorResponse(new NotFoundError('User not found', 'USER_NOT_FOUND')),
    ).toEqual({ message: 'User not found', status: 404, code: 'USER_NOT_FOUND' });
  });

  it('should derive the code from the status when the error has none', () => {
    expect(toErrorResponse(new NotFoundError())).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
    expect(toErrorResponse(new DomainError('Teapot', 418))).toMatchObject({
      status: 418,
      code: 'BAD_REQUEST',
    });
  });
});

describe('When we map an OpenAPI validator error', () => {
  it('should list the invalid fields without the request location', () => {
    const error = HttpError.create({
      status: 400,
      path: '/users',
      message: 'request.body.email should match format "email"',
      errors: [
        { path: '.body.email', message: 'should match format "email"' },
        { path: '.query.limit', message: 'should be integer' },
      ],
    });

    expect(toErrorResponse(error)).toEqual({
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'email', message: 'should match format "email"' },
        { field: 'limit', message: 'should be integer' },
      ],
    });
  });

  it.each([
    [401, 'Authorization header required', 'INVALID_TOKEN'],
    [404, 'Route not found', 'ROUTE_NOT_FOUND'],
    [405, 'PATCH method not allowed', 'METHOD_NOT_ALLOWED'],
    [415, 'unsupported media type text/plain', 'UNSUPPORTED_MEDIA_TYPE'],
  ])('should answer %i with the %s message and %s code', (status, message, code) => {
    const error = HttpError.create({
      status,
      path: '/users',
      message: status === 404 ? 'not found' : message,
      errors: [{ path: '/users', message }],
    });

    expect(toErrorResponse(error)).toEqual({ message, status, code });
  });

  it('should hide the details of a response that violates the contract', () => {
    const error = HttpError.create({
      status: 500,
      path: '/users',
      message: '.response should have required property id',
    });

    expect(toErrorResponse(error)).toEqual({
      message: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });
});

describe('When we map a body parsing error', () => {
  it.each([
    ['entity.parse.failed', 400, 'Malformed JSON body', 'INVALID_JSON'],
    ['entity.too.large', 413, 'Request body too large', 'PAYLOAD_TOO_LARGE'],
    ['charset.unsupported', 415, 'Unsupported charset', 'UNSUPPORTED_MEDIA_TYPE'],
    ['request.aborted', 400, 'Request aborted', 'REQUEST_ABORTED'],
  ])('should map %s to %i', (type, status, message, code) => {
    expect(toErrorResponse(clientHttpError(status, 'raw', type))).toEqual({
      message,
      status,
      code,
    });
  });

  it('should keep the message of any other client error', () => {
    expect(toErrorResponse(clientHttpError(422, 'Unprocessable'))).toEqual({
      message: 'Unprocessable',
      status: 422,
      code: 'BAD_REQUEST',
    });
  });
});

describe('When we map a database error', () => {
  it('should answer 409 for a duplicated unique key without echoing the value', () => {
    const error = new mongoose.mongo.MongoServerError({
      message: 'E11000 duplicate key error collection: users index: email_1',
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email: 'secret@email.com' },
    });

    expect(toErrorResponse(error)).toEqual({
      message: 'Resource already exists',
      status: 409,
      code: 'DUPLICATE_KEY',
      errors: [{ field: 'email', message: 'already exists' }],
    });
  });

  it('should answer 400 for a value that cannot be cast', () => {
    const error = new mongoose.Error.CastError('Number', 'abc', 'limit');

    expect(toErrorResponse(error)).toEqual({
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'limit', message: 'should be a valid Number' }],
    });
  });

  it('should answer 400 with every field of a schema validation error', () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      'name',
      new mongoose.Error.ValidatorError({ path: 'name', message: 'is too short' }),
    );

    expect(toErrorResponse(error)).toEqual({
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'name', message: 'is too short' }],
    });
  });

  it.each([
    new mongoose.mongo.MongoNetworkError('connection reset'),
    new mongoose.mongo.MongoNotConnectedError('not connected'),
    new mongoose.Error('Operation `users.findOne()` buffering timed out after 10000ms'),
  ])('should answer 503 when the database is unavailable (%s)', (error) => {
    expect(toErrorResponse(error)).toEqual({
      message: 'Service temporarily unavailable',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('should answer 500 for any other database error', () => {
    const error = new mongoose.mongo.MongoServerError({ message: 'boom', code: 2 });

    expect(toErrorResponse(error)).toMatchObject({ status: 500 });
  });
});

describe('When we map an unknown error', () => {
  it.each([new Error('unexpected'), 'a thrown string', undefined])(
    'should answer 500 INTERNAL_ERROR for %p',
    (error) => {
      expect(toErrorResponse(error)).toEqual({
        message: 'Internal Server Error',
        status: 500,
        code: 'INTERNAL_ERROR',
      });
    },
  );
});

describe('When the error handler middleware answers', () => {
  const req = { method: 'GET', path: '/users' } as Request;
  let res: Response;
  let next: jest.MockedFunction<NextFunction>;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    next = jest.fn();
    loggerError = jest.spyOn(Logger, 'error').mockImplementation(() => Logger);
  });

  afterEach(() => {
    loggerError.mockRestore();
  });

  it('should not log client errors', () => {
    errorHandlerMiddleware(new NotFoundError(), req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(loggerError).not.toHaveBeenCalled();
  });

  it('should log an unavailable database as a dependency error', () => {
    errorHandlerMiddleware(
      new mongoose.mongo.MongoNetworkError('connection reset'),
      req,
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(loggerError).toHaveBeenCalledWith(
      'connection reset',
      expect.objectContaining({
        eventName: 'server.dependency_unavailable',
        code: 'SERVICE_UNAVAILABLE',
      }),
    );
  });

  it('should log a thrown non-error value as a server error', () => {
    errorHandlerMiddleware('a thrown string', req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalledWith(
      'a thrown string',
      expect.objectContaining({ eventName: 'server.error' }),
    );
  });

  it('should delegate to express when the response was already sent', () => {
    const error = new Error('late failure');
    Object.assign(res, { headersSent: true });

    errorHandlerMiddleware(error, req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
