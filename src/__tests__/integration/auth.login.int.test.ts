import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { newObjectId } from '../testUtils';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    _id: newObjectId(),
    email: `login-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  await Muser.create(existingUser);
});

describe('When we log in with valid credentials', () => {
  it('should return 200 with an access token that opens protected routes', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post('/auth/login')
      .send({ email: existingUser.email, password: PASSWORD });

    expect(statusCode).toBe(200);
    expect(Object.keys(body).sort()).toEqual(['accessToken', 'refreshToken']);

    const { statusCode: updateStatus } = await supertest(app.app)
      .put(`/users/${existingUser._id}`)
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ name: 'Edward Newgate' });

    expect(updateStatus).toBe(200);
  });

  it('should accept the email in any letter case', async () => {
    const { statusCode } = await supertest(app.app)
      .post('/auth/login')
      .send({ email: existingUser.email.toUpperCase(), password: PASSWORD });

    expect(statusCode).toBe(200);
  });
});

describe('When we log in with invalid credentials', () => {
  it('should answer a wrong password and an unknown email the same way', async () => {
    const wrongPassword = await supertest(app.app)
      .post('/auth/login')
      .send({ email: existingUser.email, password: 'wrong123' });
    const unknownEmail = await supertest(app.app)
      .post('/auth/login')
      .send({ email: `nobody-${randomUUID()}@email.com`, password: PASSWORD });

    expect(wrongPassword.statusCode).toBe(401);
    expect(wrongPassword.body).toEqual({
      message: 'Invalid credentials',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(unknownEmail.statusCode).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });
});

describe('When we log in without the password', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .post('/auth/login')
      .send({ email: existingUser.email });

    expect(statusCode).toBe(400);
  });
});
