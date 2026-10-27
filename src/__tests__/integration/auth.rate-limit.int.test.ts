import { randomUUID } from 'crypto';
import path from 'path';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { AuthServiceFactory } from '../../infrastructure/config/factories/auth.service.factory';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { AuthController } from '../../interfaces/http/controllers/auth.controller';
import { loginRateLimit } from '../../interfaces/http/middlewares/rate-limit.middleware';
import { Server } from '../../interfaces/http/server';
import { newObjectId } from '../testUtils';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

// Low limits so the tests reach them; the real ones live in AuthControllerFactory.
const buildApp = (trustProxyHops = 0) =>
  new Server({
    port: 0,
    controllers: [
      new AuthController(
        AuthServiceFactory.create(),
        loginRateLimit({
          windowMilliseconds: 60_000,
          maxFailuresPerAccount: 2,
          maxFailuresPerIp: 4,
        }),
        (_req, _res, next) => next(),
      ),
    ],
    apiSpecLocation: path.resolve(__dirname, '../../contracts/service.yaml'),
    trustProxyHops,
  });

async function createUser(): Promise<string> {
  const email = `limit-${randomUUID()}@email.com`;
  await Muser.create({
    _id: newObjectId(),
    email,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return email;
}

const login = (
  server: Server,
  email: string,
  password: string,
  ip?: string,
) => {
  const request = supertest(server.app).post('/auth/login');
  if (ip) {
    request.set('X-Forwarded-For', ip);
  }
  return request.send({ email, password });
};

describe('When we fail to log in too many times on the same account', () => {
  it('should return 429 TOO_MANY_ATTEMPTS, even for the right password', async () => {
    const server = buildApp();
    const email = await createUser();
    await login(server, email, 'wrong123');
    await login(server, email, 'wrong123');

    const blocked = await login(server, email, 'wrong123');
    const withRightPassword = await login(server, email, PASSWORD);

    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toEqual({
      message: 'Too many failed login attempts, try again later',
      status: 429,
      code: 'TOO_MANY_ATTEMPTS',
    });
    expect(blocked.headers).toHaveProperty('ratelimit');
    expect(withRightPassword.statusCode).toBe(429);
  });

  it('should not block another account from the same IP', async () => {
    const server = buildApp();
    const blockedEmail = await createUser();
    const otherEmail = await createUser();
    await login(server, blockedEmail, 'wrong123');
    await login(server, blockedEmail, 'wrong123');

    const { statusCode } = await login(server, otherEmail, PASSWORD);

    expect(statusCode).toBe(200);
  });
});

describe('When we log in successfully many times', () => {
  it('should not count successful attempts', async () => {
    const server = buildApp();
    const email = await createUser();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { statusCode } = await login(server, email, PASSWORD);
      expect(statusCode).toBe(200);
    }
  });
});

describe('When one IP fails on many accounts', () => {
  it('should block that IP for every account', async () => {
    const server = buildApp();
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await login(server, `nobody-${attempt}@email.com`, 'wrong123');
    }
    const email = await createUser();

    const { statusCode } = await login(server, email, PASSWORD);

    expect(statusCode).toBe(429);
  });
});

describe('When the app is behind a proxy', () => {
  it('should limit each client IP from X-Forwarded-For, not the proxy', async () => {
    const server = buildApp(1);
    const email = await createUser();
    await login(server, email, 'wrong123', '203.0.113.1');
    await login(server, email, 'wrong123', '203.0.113.1');

    const fromBlockedClient = await login(server, email, PASSWORD, '203.0.113.1');
    const fromAnotherClient = await login(server, email, PASSWORD, '203.0.113.2');

    expect(fromBlockedClient.statusCode).toBe(429);
    expect(fromAnotherClient.statusCode).toBe(200);
  });
});
