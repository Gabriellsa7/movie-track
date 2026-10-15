import mongoose from 'mongoose';
import supertest from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IParamsCreateUser } from '../../domain/user/interfaces/user.service.interface';

const OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/;

let paramsCreate: IParamsCreateUser;

beforeEach(async () => {
  paramsCreate = {
    email: `create-${new mongoose.Types.ObjectId().toHexString()}@email.com`,
    name: 'Whitebeard',
    password: 'secret123',
  };
});

describe('When we try to create a valid user', () => {
  it('should return 201 with server-generated fields and no password', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send(paramsCreate);

    expect(statusCode).toBe(201);
    expect(body).toMatchObject({
      name: paramsCreate.name,
      email: paramsCreate.email,
    });
    expect(body.id).toMatch(OBJECT_ID_PATTERN);
    expect(new Date(body.createdAt).getTime()).not.toBeNaN();
    expect(body.updatedAt).toBe(body.createdAt);
    expect(body.password).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
    expect(body._id).toBeUndefined();
  });

  it('should store only a bcrypt hash of the password', async () => {
    const { body } = await supertest(app.app).post(`/users`).send(paramsCreate);

    const userInDb = await Muser.findOne({ _id: body.id }).lean();

    expect(userInDb?.passwordHash).toBeDefined();
    expect(userInDb?.passwordHash).not.toBe(paramsCreate.password);
    await expect(
      bcrypt.compare(paramsCreate.password, String(userInDb?.passwordHash)),
    ).resolves.toBe(true);
  });

  it('should store the email trimmed and lowercase', async () => {
    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, email: paramsCreate.email.toUpperCase() });

    expect(statusCode).toBe(201);
    expect(body.email).toBe(paramsCreate.email);
  });
});

describe('When we try to create a user sending server-generated fields', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, id: 'client-id', createdAt: new Date() });

    expect(statusCode).toBe(400);
  });
});

describe('When we try to create a user with an invalid email', () => {
  it('should return 400 rejected by the contract validation', async () => {
    const { statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, email: 'not-an-email' });

    expect(statusCode).toBe(400);
  });
});

describe('When we try to create a user with a weak password', () => {
  it.each(['short1', 'onlyletters', '12345678'])(
    'should return 400 for "%s"',
    async (password) => {
      const { statusCode } = await supertest(app.app)
        .post(`/users`)
        .send({ ...paramsCreate, password });

      expect(statusCode).toBe(400);
    },
  );
});

describe('When we try to create a user with an email already in use', () => {
  it('should return 409 with the contract error shape', async () => {
    await supertest(app.app).post(`/users`).send(paramsCreate);

    const { body, statusCode } = await supertest(app.app)
      .post(`/users`)
      .send({ ...paramsCreate, email: paramsCreate.email.toUpperCase() });

    expect(statusCode).toBe(409);
    expect(body).toMatchObject({
      message: 'A user with this email already exists',
      status: 409,
    });
  });
});
