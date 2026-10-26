import { DomainError } from './domain.error';

export class ServiceUnavailableError extends DomainError {
  constructor(message = 'Service unavailable', code?: string) {
    super(message, 503, code);
  }
}
