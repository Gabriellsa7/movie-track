import { DomainError } from './domain.error';

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found', code?: string) {
    super(message, 404, code);
  }
}
