import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { authHeaderFor, newObjectId } from '../testUtils';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    _id: newObjectId(),
    email: `update-${Date.now()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

const updateUser = (body: object) =>
  supertest(app.app)
    .put(`/users/${existingUser._id}`)
    .set('Authorization', authHeaderFor(existingUser._id))
    .send(body);

describe('When we change our e-mail', () => {
  it('should return 422 CURRENT_PASSWORD_REQUIRED without the current password', async () => {
    const { body, statusCode } = await updateUser({
      email: `new-${Date.now()}@email.com`,
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('CURRENT_PASSWORD_REQUIRED');
    const inDb = await Muser.findById(existingUser._id).lean();
    expect(inDb?.email).toBe(existingUser.email);
  });

  it('should return 401 INVALID_CREDENTIALS with a wrong password', async () => {
    const { body, statusCode } = await updateUser({
      email: `new-${Date.now()}@email.com`,
      currentPassword: 'wrong123',
    });

    expect(statusCode).toBe(401);
    expect(body.code).toBe('INVALID_CREDENTIALS');
  });

  it('should change it with the right password', async () => {
    const newEmail = `new-${Date.now()}@email.com`;

    const { body, statusCode } = await updateUser({
      email: newEmail,
      currentPassword: PASSWORD,
    });

    expect(statusCode).toBe(200);
    expect(body.email).toBe(newEmail);
  });

  it('should not ask for the password when the e-mail stays the same', async () => {
    const { statusCode } = await updateUser({
      email: existingUser.email.toUpperCase(),
      name: 'Edward Newgate',
    });

    expect(statusCode).toBe(200);
  });
});

describe('When we update an existing user', () => {
  it('should return 200 with the updated user and persist the change', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser._id}`)
      .set('Authorization', authHeaderFor(existingUser._id))
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(200);
    expect(body.name).toBe('Edward Newgate');
    expect(body.email).toBe(existingUser.email);
    expect(body._id).toBeUndefined();

    expect(body.passwordHash).toBeUndefined();
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      existingUser.updatedAt.getTime(),
    );

    const userInDb = await Muser.findOne({ _id: existingUser._id });
    expect(userInDb?.name).toBe('Edward Newgate');
  });
});

describe('When we update a user with an email used by another user', () => {
  it('should return 409 with the contract error shape', async () => {
    const otherUser = {
      ...existingUser,
      _id: newObjectId(),
      email: `other-${Date.now()}@email.com`,
    };
    await Muser.create(otherUser);

    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser._id}`)
      .set('Authorization', authHeaderFor(existingUser._id))
      .send({ email: otherUser.email.toUpperCase(), currentPassword: PASSWORD });

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      message: 'A user with this email already exists',
      status: 409,
    });
  });
});

describe('When we update a user that does not exist', () => {
  it('should return 404 with the contract error shape', async () => {
    const missingUserId = newObjectId();
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
      .put(`/users/${existingUser._id}`)
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(401);
  });

  it('should return 401 with INVALID_TOKEN for a forged token', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser._id}`)
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ name: 'Edward Newgate' });

    expect(statusCode).toBe(401);
    expect(body).toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
  });
});

describe('When we update another user', () => {
  it('should return 403 and keep the other user unchanged', async () => {
    const { body, statusCode } = await supertest(app.app)
      .put(`/users/${existingUser._id}`)
      .set('Authorization', authHeaderFor(newObjectId()))
      .send({ name: 'Hacked' });

    const userInDb = await Muser.findOne({ _id: existingUser._id }).lean();

    expect(statusCode).toBe(403);
    expect(body).toMatchObject({ status: 403, code: 'FORBIDDEN_RESOURCE' });
    expect(userInDb?.name).toBe(existingUser.name);
  });
});
