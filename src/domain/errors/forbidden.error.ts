import { DomainError } from './domain.error';

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden', code?: string) {
    super(message, 403, code);
  }
}
