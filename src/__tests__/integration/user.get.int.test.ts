import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { IUser } from '../../domain/user/interfaces/user.interface';

const NAME_PREFIX = `get${Date.now()}`;

let existingUser: IUser;

beforeEach(async () => {
  existingUser = {
    id: randomUUID(),
    email: `get-${randomUUID()}@email.com`,
    name: `${NAME_PREFIX} Whitebeard`,
    passwordHash: 'hashed-secret123',
    avatarUrl: 'https://cdn.example.com/avatar.png',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  await Muser.create(existingUser);
});

describe('When we get a user profile', () => {
  it('should return 200 with only public fields', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${existingUser.id}`,
    );

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      id: existingUser.id,
      name: existingUser.name,
      avatarUrl: existingUser.avatarUrl,
      memberSince: existingUser.createdAt.toISOString(),
    });
  });
});

describe('When we get a user that does not exist', () => {
  it('should return 404 with the USER_NOT_FOUND code', async () => {
    const { body, statusCode } = await supertest(app.app).get(
      `/users/${randomUUID()}`,
    );

    expect(statusCode).toBe(404);
    expect(body).toEqual({
      message: 'User not found',
      status: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('should return 400 when the id is not a UUID', async () => {
    const { statusCode } = await supertest(app.app).get('/users/not-a-uuid');

    expect(statusCode).toBe(400);
  });
});

describe('When we list users', () => {
  it('should return a page of public summaries with metadata', async () => {
    const { body, statusCode } = await supertest(app.app).get('/users');

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ page: 1, limit: 20 });
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.items[0]).not.toHaveProperty('email');
    expect(body.items[0]).not.toHaveProperty('createdAt');
  });

  it('should search by name ignoring case and accents', async () => {
    await Muser.create({
      ...existingUser,
      id: randomUUID(),
      email: `get-${randomUUID()}@email.com`,
      name: `${NAME_PREFIX} Édouard`,
    });

    const { body, statusCode } = await supertest(app.app)
      .get('/users')
      .query({ search: `${NAME_PREFIX.toUpperCase()} EDOU` });

    expect(statusCode).toBe(200);
    expect(body.total).toBe(1);
    expect(body.items).toEqual([
      expect.objectContaining({ name: `${NAME_PREFIX} Édouard` }),
    ]);
  });

  it('should paginate with page and limit', async () => {
    const { body, statusCode } = await supertest(app.app)
      .get('/users')
      .query({ search: NAME_PREFIX, page: 2, limit: 1 });

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ page: 2, limit: 1 });
    expect(body.items).toHaveLength(1);
  });

  it('should return 400 when the limit is above the contract maximum', async () => {
    const { statusCode } = await supertest(app.app).get('/users?limit=51');

    expect(statusCode).toBe(400);
  });
});
