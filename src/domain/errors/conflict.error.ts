import { DomainError } from './domain.error';

export class ConflictError extends DomainError {
  constructor(message = 'Resource already exists', code?: string) {
    super(message, 409, code);
  }
}
