import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { authHeaderFor } from '../testUtils';

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `update-${Date.now()}@email.com`,
    name: 'Whitebeard',
    passwordHash: 'hashed-secret123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we update an existing user', () => {
  it('should return 200 with the updated user and persist the change', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(existingUser.id))
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(200);
    expect(body.name).toBe('Edward Newgate');
    expect(body.email).toBe(existingUser.email);
    expect(body._id).toBeUndefined();

    expect(body.passwordHash).toBeUndefined();
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      existingUser.updatedAt.getTime(),
    );

    const userInDb = await Muser.findOne({ id: existingUser.id });
    expect(userInDb?.name).toBe('Edward Newgate');
  });
});

describe('When we update a user with an email used by another user', () => {
  it('should return 409 with the contract error shape', async () => {
    const otherUser = {
      ...existingUser,
      id: randomUUID(),
      email: `other-${Date.now()}@email.com`,
    };
    await Muser.create(otherUser);

    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(existingUser.id))
      .send({ email: otherUser.email.toUpperCase() });

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      message: 'A user with this email already exists',
      status: 409,
    });
  });
});

describe('When we update a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const missingUserId = randomUUID();
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${missingUserId}`)
      .set('Authorization', authHeaderFor(missingUserId))
      .send({ name: 'Nobody' });

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});

describe('When we update a user without a valid token', () => {
  it('should return 401 when the Authorization header is missing', async () => {
    const { statusCode } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(401);
  });

  it('should return 401 with INVALID_TOKEN for a forged token', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser.id}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  });
});
