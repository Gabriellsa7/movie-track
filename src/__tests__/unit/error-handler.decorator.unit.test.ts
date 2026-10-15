import { Logger } from 'traceability';
import { ErrorHandler } from '../../domain/common/decorators/error-handler.decorator';
import { NotFoundError } from '../../domain/errors/not-found.error';

class AService {
  constructor(private readonly prefix: string) {}

  @ErrorHandler()
  async greet(name: string): Promise<string> {
    return `${this.prefix} ${name}`;
  }

  @ErrorHandler()
  async findMissing(): Promise<void> {
    throw new NotFoundError('Customer not found');
  }

  @ErrorHandler()
  async crash(): Promise<void> {
    throw new Error('database down');
  }

  @ErrorHandler()
  crashSync(): string {
    throw new Error('sync failure');
  }

  @ErrorHandler()
  async throwNonError(): Promise<void> {
    throw 'plain failure';
  }

  @ErrorHandler()
  greetSync(name: string): string {
    return `${this.prefix} ${name}`;
  }
}

const service = new AService('Hello');
let loggerErrorSpy: jest.SpyInstance;

beforeEach(() => {
  loggerErrorSpy = jest.spyOn(Logger, 'error').mockImplementation(() => Logger);
});

afterEach(() => {
  loggerErrorSpy.mockRestore();
});

describe('When a decorated service method succeeds', () => {
  it('should keep `this` and return the result of async methods', async () => {
    await expect(service.greet('Luffy')).resolves.toBe('Hello Luffy');
  });

  it('should keep sync methods synchronous', () => {
    expect(service.greetSync('Zoro')).toBe('Hello Zoro');
  });
});

describe('When a decorated service method fails', () => {
  it('should rethrow domain errors without logging them', async () => {
    await expect(service.findMissing()).rejects.toThrow(NotFoundError);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  it('should log unexpected async errors and rethrow them', async () => {
    await expect(service.crash()).rejects.toThrow('database down');
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in AService.crash',
      expect.objectContaining({
        eventName: 'service.unexpected_error',
        service: 'AService',
        method: 'crash',
        error: 'database down',
      }),
    );
  });

  it('should log unexpected sync errors and rethrow them', () => {
    expect(() => service.crashSync()).toThrow('sync failure');
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in AService.crashSync',
      expect.objectContaining({ method: 'crashSync' }),
    );
  });

  it('should log values that are not Error instances as strings', async () => {
    await expect(service.throwNonError()).rejects.toBe('plain failure');
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'Unexpected error in AService.throwNonError',
      expect.objectContaining({ error: 'plain failure', stack: undefined }),
    );
  });
});
