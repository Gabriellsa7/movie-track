import { DomainError } from './domain.error';

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized', code?: string) {
    super(message, 401, code);
  }
}
