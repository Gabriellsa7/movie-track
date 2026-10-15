import { DomainError } from '../../domain/errors/domain.error';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { ConflictError } from '../../domain/errors/conflict.error';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';
import { ForbiddenError } from '../../domain/errors/forbidden.error';

describe('When we create domain errors without arguments', () => {
  it('should default DomainError to status 500', () => {
    const error = new DomainError('Something failed');

    expect(error.status).toBe(500);
    expect(error.name).toBe('DomainError');
  });

  it('should default ForbiddenError to a generic 403 message', () => {
    const error = new ForbiddenError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Forbidden');
    expect(error.status).toBe(403);
  });

  it('should default NotFoundError to a generic 404 message', () => {
    const error = new NotFoundError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Resource not found');
    expect(error.status).toBe(404);
  });

  it('should default ConflictError to a generic 409 message', () => {
    const error = new ConflictError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Resource already exists');
    expect(error.status).toBe(409);
  });

  it('should default UnauthorizedError to a generic 401 message', () => {
    const error = new UnauthorizedError();

    expect(error).toBeInstanceOf(DomainError);
    expect(error.message).toBe('Unauthorized');
    expect(error.status).toBe(401);
    expect(error.code).toBeUndefined();
  });
});

describe('When we create domain errors with a code', () => {
  it('should expose the code for the error handler', () => {
    expect(new NotFoundError('User not found', 'USER_NOT_FOUND')).toMatchObject(
      { status: 404, code: 'USER_NOT_FOUND' },
    );
    expect(new ConflictError('Taken', 'EMAIL_TAKEN').code).toBe('EMAIL_TAKEN');
    expect(new UnauthorizedError('Nope', 'INVALID_CREDENTIALS').code).toBe(
      'INVALID_CREDENTIALS',
    );
  });
});
