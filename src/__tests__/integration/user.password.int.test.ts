import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { authHeaderFor, newObjectId } from '../testUtils';

const PASSWORD = 'secret123';
const NEW_PASSWORD = 'newSecret456';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    _id: newObjectId(),
    email: `password-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we change the password with the right current password', () => {
  it('should return 204 and store a hash of the new password', async () => {
    const { statusCode } = await supertest(app.app)
      .patch(`/users/${existingUser._id}/password`)
      .set('Authorization', authHeaderFor(existingUser._id))
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    const userInDb = await Muser.findOne({ _id: existingUser._id }).lean();

    expect(statusCode).toBe(204);
    await expect(
      bcrypt.compare(NEW_PASSWORD, String(userInDb?.passwordHash)),
    ).resolves.toBe(true);
  });
});

describe('When we change the password with a wrong current password', () => {
  it('should return 401 and keep the old password', async () => {
    const { body, statusCode } = await supertest(app.app)
      .patch(`/users/${existingUser._id}/password`)
      .set('Authorization', authHeaderFor(existingUser._id))
      .send({ currentPassword: 'wrong123', newPassword: NEW_PASSWORD });

    const userInDb = await Muser.findOne({ _id: existingUser._id }).lean();

    expect(statusCode).toBe(401);
    expect(body).toEqual({
      message: 'Invalid credentials',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(userInDb?.passwordHash).toBe(existingUser.passwordHash);
  });
});

describe('When we change the password to a weak one', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .patch(`/users/${existingUser._id}/password`)
      .set('Authorization', authHeaderFor(existingUser._id))
      .send({ currentPassword: PASSWORD, newPassword: 'onlyletters' });

    expect(statusCode).toBe(400);
  });
});

describe('When we change the password of a user that does not exist', () => {
  it('should return 404 with the USER_NOT_FOUND code', async () => {
    const missingUserId = newObjectId();
    const { body, statusCode } = await supertest(app.app)
      .patch(`/users/${missingUserId}/password`)
      .set('Authorization', authHeaderFor(missingUserId))
      .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });

    expect(statusCode).toBe(404);
    expect(body).toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});
