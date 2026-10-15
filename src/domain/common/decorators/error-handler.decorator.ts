import { Logger } from 'traceability';
import { DomainError } from '../../errors/domain.error';

function logUnexpectedError(
  instance: unknown,
  methodName: string,
  error: unknown,
): void {
  if (error instanceof DomainError) {
    return;
  }
  const serviceName =
    (instance as { constructor?: { name?: string } })?.constructor?.name ??
    'UnknownService';
  Logger.error(`Unexpected error in ${serviceName}.${methodName}`, {
    eventName: 'service.unexpected_error',
    service: serviceName,
    method: methodName,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

export function ErrorHandler() {
  return function <This, Args extends unknown[], Return>(
    method: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Return
    >,
  ) {
    const methodName = String(context.name);

    return function (this: This, ...args: Args): Return {
      const handleError = (error: unknown): never => {
        logUnexpectedError(this, methodName, error);
        throw error;
      };

      try {
        const result = method.call(this, ...args);
        if (result instanceof Promise) {
          return result.catch(handleError) as Return;
        }
        return result;
      } catch (error) {
        return handleError(error);
      }
    };
  };
}
