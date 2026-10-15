import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { authHeaderFor } from '../testUtils';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `delete-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we delete a user with the right password', () => {
  it('should return 204 and remove the user from the database', async () => {
    const { body, statusCode } = await supertest(app.app)
      .delete(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(existingUser.id))
      .send({ password: PASSWORD });

    expect(statusCode).toBe(204);
    expect(body).toEqual({});
    await expect(Muser.findOne({ id: existingUser.id })).resolves.toBeNull();
  });
});

describe('When we delete a user with a wrong password', () => {
  it('should return 401 and keep the user', async () => {
    const { body, statusCode } = await supertest(app.app)
      .delete(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(existingUser.id))
      .send({ password: 'wrong123' });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    await expect(
      Muser.findOne({ id: existingUser.id }),
    ).resolves.not.toBeNull();
  });
});

describe('When we delete a user without the password', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .delete(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(existingUser.id))
      .send({});

    expect(statusCode).toBe(400);
  });
});

describe('When we delete a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const missingUserId = randomUUID();
    const { body, statusCode } = await supertest(app.app)
      .delete(`/users/${missingUserId}`)
      .set('Authorization', authHeaderFor(missingUserId))
      .send({ password: PASSWORD });

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ message: 'User not found', status: 404 });
  });
});

describe('When we delete another user', () => {
  it('should return 403 and keep the user', async () => {
    const { statusCode } = await supertest(app.app)
      .delete(`/users/${existingUser.id}`)
      .set('Authorization', authHeaderFor(randomUUID()))
      .send({ password: PASSWORD });

    expect(statusCode).toBe(403);
    await expect(
      Muser.findOne({ id: existingUser.id }),
    ).resolves.not.toBeNull();
  });
});
