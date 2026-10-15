export class DomainError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
  }
}
