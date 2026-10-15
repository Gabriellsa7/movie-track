import { DomainError } from './domain.error';

export class UnprocessableEntityError extends DomainError {
  constructor(message = 'Unprocessable entity', code?: string) {
    super(message, 422, code);
  }
}
