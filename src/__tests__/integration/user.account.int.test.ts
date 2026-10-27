import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { authHeaderFor, newObjectId } from '../testUtils';

const getAccount = (userId: string, tokenUserId = userId) =>
  supertest(app.app)
    .get(`/users/${userId}/account`)
    .set('Authorization', authHeaderFor(tokenUserId));

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    _id: newObjectId(),
    email: `account-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: 'hashed-secret123',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  };
  await Muser.create(existingUser);
});

describe('When we get our own account', () => {
  it('should return 200 with the private user and no password hash', async () => {
    const { body, statusCode } = await getAccount(existingUser._id);

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      id: existingUser._id,
      name: existingUser.name,
      email: existingUser.email,
      emailVerified: false,
      avatarUrl: existingUser.avatarUrl,
      createdAt: existingUser.createdAt.toISOString(),
      updatedAt: existingUser.updatedAt.toISOString(),
    });
  });

  it('should say when the e-mail was confirmed', async () => {
    await Muser.updateOne(
      { _id: existingUser._id },
      { emailVerified: true },
    );

    const { body, statusCode } = await getAccount(existingUser._id);

    expect(statusCode).toBe(200);
    expect(body.emailVerified).toBe(true);
  });
});

describe('When the account of the token no longer exists', () => {
  it('should return 404 USER_NOT_FOUND', async () => {
    const { body, statusCode } = await getAccount(newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('USER_NOT_FOUND');
  });
});

describe("When we get another user's account", () => {
  it('should return 403 FORBIDDEN_RESOURCE', async () => {
    const { body, statusCode } = await getAccount(
      existingUser._id,
      newObjectId(),
    );

    expect(statusCode).toBe(403);
    expect(body.code).toBe('FORBIDDEN_RESOURCE');
  });
});

describe('When we get an account without a token', () => {
  it('should return 401', async () => {
    const { statusCode } = await supertest(app.app).get(
      `/users/${existingUser._id}/account`,
    );

    expect(statusCode).toBe(401);
  });
});
