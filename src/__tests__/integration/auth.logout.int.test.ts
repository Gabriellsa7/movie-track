import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { newObjectId } from '../testUtils';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { MrevokedToken } from '../../infrastructure/db/mongo/models/revoked-token.model';
import { IUser } from '../../domain/user/interfaces/user.interface';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    _id: newObjectId(),
    email: `logout-${randomUUID()}@email.com`,
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

const logout = (refreshToken: string) =>
  supertest(app.app).post('/auth/logout').send({ refreshToken });

const refresh = (refreshToken: string) =>
  supertest(app.app).post('/auth/refresh').send({ refreshToken });

describe('When we log out', () => {
  it('should return 204 and refuse that refresh token afterwards with TOKEN_REVOKED', async () => {
    const { refreshToken } = await login();

    const { statusCode } = await logout(refreshToken);
    expect(statusCode).toBe(204);

    const { body, statusCode: refreshStatus } = await refresh(refreshToken);
    expect(refreshStatus).toBe(401);
    expect(body.code).toBe('TOKEN_REVOKED');
  });

  it('should keep the other sessions of the same user logged in', async () => {
    const phone = await login();
    const laptop = await login();

    await logout(phone.refreshToken);

    const { statusCode } = await refresh(laptop.refreshToken);
    expect(statusCode).toBe(200);
  });

  it('should keep the revoked token only until it would expire', async () => {
    const { refreshToken } = await login();

    await logout(refreshToken);

    const { jti, exp } = jwt.decode(refreshToken) as {
      jti: string;
      exp: number;
    };
    const revoked = await MrevokedToken.findOne({ tokenId: jti }).lean();
    expect(revoked?.expiresAt).toEqual(new Date(exp * 1000));
  });

  it('should accept logging out twice with the same token', async () => {
    const { refreshToken } = await login();

    await logout(refreshToken);
    const { statusCode } = await logout(refreshToken);

    expect(statusCode).toBe(204);
  });
});

describe('When we log out with a token that is not a refresh token', () => {
  it('should return 401 INVALID_TOKEN for an access token', async () => {
    const { accessToken } = await login();

    const { body, statusCode } = await logout(accessToken);

    expect(statusCode).toBe(401);
    expect(body.code).toBe('INVALID_TOKEN');
  });

  it('should return 400 without a refresh token', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post('/auth/logout')
      .send({});

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('When we log out with an expired refresh token', () => {
  it('should return 204, since it can no longer be used', async () => {
    const expiredToken = jwt.sign(
      {
        sub: existingUser._id,
        ver: 0,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      process.env.REFRESH_TOKEN_SECRET!,
      { jwtid: randomUUID() },
    );

    const { statusCode } = await logout(expiredToken);

    expect(statusCode).toBe(204);
  });
});
