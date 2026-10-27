import { randomUUID } from 'crypto';
import path from 'path';
import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { UserServiceFactory } from '../../infrastructure/config/factories/user.service.factory';
import { UserController } from '../../interfaces/http/controllers/user.controller';
import { requestRateLimit } from '../../interfaces/http/middlewares/rate-limit.middleware';
import { Server } from '../../interfaces/http/server';

const passthrough = () => (_req: unknown, _res: unknown, next: () => void) =>
  next();

// A low limit so the test reaches it; the real one lives in UserControllerFactory.
const buildApp = () =>
  new Server({
    port: 0,
    controllers: [
      new UserController(
        UserServiceFactory.create(),
        passthrough(),
        passthrough(),
        requestRateLimit({
          windowMilliseconds: 60_000,
          limit: 2,
          identifier: 'sign-up-test',
          key: () => 'same-ip',
          onlySuccessful: true,
        }),
      ),
    ],
    apiSpecLocation: path.resolve(__dirname, '../../contracts/service.yaml'),
  });

const signUp = (server: Server, email = `limit-${randomUUID()}@email.com`) =>
  supertest(server.app)
    .post('/users')
    .send({ name: 'Whitebeard', email, password: 'secret123' });

describe('When one IP creates too many accounts', () => {
  it('should return 429 TOO_MANY_REQUESTS after the limit', async () => {
    const server = buildApp();

    const statuses = [
      (await signUp(server)).statusCode,
      (await signUp(server)).statusCode,
      (await signUp(server)).statusCode,
    ];

    expect(statuses).toEqual([201, 201, 429]);
  });

  it('should not count sign-ups that failed', async () => {
    const server = buildApp();
    await signUp(server, 'not-an-email');
    await signUp(server, 'not-an-email');
    await signUp(server, 'not-an-email');

    const { statusCode } = await signUp(server);

    expect(statusCode).toBe(201);
  });
});
