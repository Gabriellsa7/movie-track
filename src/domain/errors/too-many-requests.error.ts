import { DomainError } from './domain.error';

export class TooManyRequestsError extends DomainError {
  constructor(message = 'Too many requests', code?: string) {
    super(message, 429, code);
  }
}
