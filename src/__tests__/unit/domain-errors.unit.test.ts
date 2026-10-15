import { DomainError } from '../../domain/errors/domain.error';
import { NotFoundError } from '../../domain/errors/not-found.error';
import { ConflictError } from '../../domain/errors/conflict.error';

describe('When we create domain errors without arguments', () => {
  it('should default DomainError to status 500', () => {
    const error = new DomainError('Something failed');

    expect(error.status).toBe(500);
    expect(error.name).toBe('DomainError');
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
});
