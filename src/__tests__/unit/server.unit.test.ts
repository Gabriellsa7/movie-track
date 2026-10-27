import path from 'path';
import supertest from 'supertest';
import mongoose from 'mongoose';
import {
  NextFunction,
  Request,
  RequestHandler,
  Response,
  Router,
} from 'express';
import { Server } from '../../interfaces/http/server';
import { IController } from '../../interfaces/http/controllers/controller.interface';

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../../contracts/service.yaml',
);

class ThrowingController implements IController {
  private readonly router = Router();

  constructor() {
    this.router.get(
      '/users',
      (req: Request, res: Response, next: NextFunction) => {
        next(new Error('unexpected failure'));
      },
    );
    this.router.get('/users/:id', (req: Request, res: Response) => {
      res.status(404).json({});
    });
  }

  getRoutes(): Router {
    return this.router;
  }
}

const passthroughMiddleware: RequestHandler = (req, res, next) => next();

const app = new Server({
  port: 0,
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
  controllers: [new ThrowingController()],
  middlewaresToStart: [passthroughMiddleware],
  timeoutMilliseconds: 1000,
});

describe('When a browser calls the API from another origin', () => {
  const ALLOWED_ORIGIN = 'http://localhost:5173';
  const corsApp = new Server({
    port: 0,
    apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
    corsOrigins: [ALLOWED_ORIGIN],
  });

  it('should answer the preflight of an allowed origin with 204', async () => {
    const { statusCode, headers } = await supertest(corsApp.app)
      .options('/movies')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(statusCode).toBe(204);
    expect(headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(headers['access-control-allow-methods']).toContain('PATCH');
  });

  it('should let the browser read the rate limit headers', async () => {
    const { headers } = await supertest(corsApp.app)
      .get('/health')
      .set('Origin', ALLOWED_ORIGIN);

    expect(headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(headers['access-control-expose-headers']).toBe(
      'RateLimit,RateLimit-Policy,Retry-After',
    );
  });

  it('should not allow an origin outside the list', async () => {
    const { headers } = await supertest(corsApp.app)
      .get('/health')
      .set('Origin', 'https://evil.example');

    expect(headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow no origin when none is configured', async () => {
    const { headers } = await supertest(app.app)
      .get('/health')
      .set('Origin', ALLOWED_ORIGIN);

    expect(headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('When we check the health endpoint', () => {
  it('should return 200 with status OK', async () => {
    const { statusCode, body } = await supertest(app.app).get('/health');

    expect(statusCode).toBe(200);
    expect(body).toEqual({ status: 'OK' });
  });
});

describe('When we open the API docs', () => {
  it('should serve Swagger UI', async () => {
    const { statusCode, text } = await supertest(app.app).get('/docs/');

    expect(statusCode).toBe(200);
    expect(text).toContain('swagger-ui');
  });

  it('should load the contract with its title and bearer auth', async () => {
    const { statusCode, text } = await supertest(app.app).get(
      '/docs/swagger-ui-init.js',
    );

    expect(statusCode).toBe(200);
    expect(text).toContain('Movie Track API');
    expect(text).toContain('bearerAuth');
  });
});

describe('When an unexpected error reaches the central handler', () => {
  it('should respond 500 with the contract error shape', async () => {
    const { statusCode, body } = await supertest(app.app).get('/users');

    expect(statusCode).toBe(500);
    expect(body).toMatchObject({
      message: 'Internal Server Error',
      status: 500,
    });
  });
});

describe('When the request body is not valid JSON', () => {
  it('should respond 400 with the INVALID_JSON code', async () => {
    const { statusCode, body } = await supertest(app.app)
      .post('/users')
      .set('Content-Type', 'application/json')
      .send('{ "name": "Boruto", }');

    expect(statusCode).toBe(400);
    expect(body).toEqual({
      message: 'Malformed JSON body',
      status: 400,
      code: 'INVALID_JSON',
    });
  });
});

describe('When the request body is larger than the limit', () => {
  it('should respond 413 with the PAYLOAD_TOO_LARGE code', async () => {
    const { statusCode, body } = await supertest(app.app)
      .post('/users')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(4 * 1024 * 1024) }));

    expect(statusCode).toBe(413);
    expect(body).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });
});

describe('When the request breaks the contract', () => {
  it('should respond 400 listing every invalid field', async () => {
    const { statusCode, body } = await supertest(app.app)
      .post('/users')
      .send({ name: 'Boruto', email: 'not-an-email', passwordHash: 'x' });

    expect(statusCode).toBe(400);
    expect(body).toMatchObject({
      message: 'Validation failed',
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    expect(body.errors).toEqual(
      expect.arrayContaining([
        { field: 'email', message: 'should match format "email"' },
        { field: 'passwordHash', message: 'should NOT have additional properties' },
      ]),
    );
  });

  it.each([
    ['get', '/not-a-route', 404, 'ROUTE_NOT_FOUND'],
    ['patch', '/users', 405, 'METHOD_NOT_ALLOWED'],
  ] as const)(
    'should respond %s %s with %i %s',
    async (method, url, status, code) => {
      const { statusCode, body } = await supertest(app.app)[method](url);

      expect(statusCode).toBe(status);
      expect(body).toMatchObject({ status, code });
    },
  );

  it('should respond 415 for a body that is not JSON', async () => {
    const { statusCode, body } = await supertest(app.app)
      .post('/users')
      .set('Content-Type', 'text/plain')
      .send('hello');

    expect(statusCode).toBe(415);
    expect(body).toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' });
  });
});

describe('When a response violates the contract', () => {
  it('should log and respond 500 through the central handler', async () => {
    const { statusCode, body } = await supertest(app.app).get(
      '/users/000000000000000000000000',
    );

    expect(statusCode).toBe(500);
    expect(body).toMatchObject({ status: 500 });
  });
});

describe('When we create a server without an api spec', () => {
  it('should fail at construction time', () => {
    expect(() => new Server({ port: 0 })).toThrow();
  });
});

describe('When we set up the database without a URI', () => {
  it('should fail fast with a clear message', async () => {
    await expect(app.databaseSetup()).rejects.toThrow(
      'Database URI not provided',
    );
  });
});

describe('When we set up and close the database with a URI', () => {
  it('should connect through mongoose and disconnect cleanly', async () => {
    const connectSpy = jest
      .spyOn(mongoose, 'connect')
      .mockImplementation(async () => mongoose);
    app.DATABASE_URI = 'mongodb://localhost/unit-test';

    await app.databaseSetup();
    expect(connectSpy).toHaveBeenCalledWith('mongodb://localhost/unit-test');

    await app.closeDatabase();

    connectSpy.mockRestore();
    app.DATABASE_URI = undefined;
  });
});

describe('When we start listening', () => {
  it('should open and close the http server', async () => {
    const httpServer = app.listen();
    await new Promise((resolve) => httpServer.once('listening', resolve));

    expect(httpServer.listening).toBe(true);

    await new Promise((resolve) => httpServer.close(resolve));
  });
});
