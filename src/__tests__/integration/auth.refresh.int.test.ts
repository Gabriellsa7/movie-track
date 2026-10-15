import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { TokenProviderFactory } from '../../infrastructure/config/factories/token.provider.factory';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `refresh-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

async function login() {
  const { body } = await supertest(app.app)
    .post('/auth/login')
    .send({ email: existingUser.email, password: PASSWORD });
  return body as { accessToken: string; refreshToken: string };
}

describe('When we refresh with a valid refresh token', () => {
  it('should return 200 with a new access token that opens protected routes', async () => {
    const { refreshToken } = await login();

    const { body, statusCode } = await supertest(app.app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['accessToken', 'refreshToken']);

    const { statusCode: updateStatus } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ name: 'Edward Newgate' });

    expect(updateStatus).toBe(200);
  });
});

describe('When we refresh with a token that is not a refresh token', () => {
  it('should return 401 with INVALID_TOKEN for an access token', async () => {
    const { accessToken } = await login();

    const { body, statusCode } = await supertest(app.app)
      .post('/auth/refresh')
      .send({ refreshToken: accessToken });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  });

  it('should return 401 with INVALID_TOKEN for a forged token', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post('/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  });
});

describe('When we refresh the token of a deleted user', () => {
  it('should return 401 with INVALID_TOKEN', async () => {
    const refreshToken = TokenProviderFactory.create().generateRefreshToken({
      sub: randomUUID(),
    });

    const { body, statusCode } = await supertest(app.app)
      .post('/auth/refresh')
      .send({ refreshToken });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  });
});
