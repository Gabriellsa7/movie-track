import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { Muser } from '../../infrastructure/db/mongo/models/user.model';
import { CryptoSecureTokenProvider } from '../../infrastructure/providers/secure-token/crypto.secure-token-provider';
import { authHeaderFor, newObjectId } from '../testUtils';

const PASSWORD = 'secret123';
const LOW_COST_ROUNDS = 4;
const ONE_HOUR = 60 * 60 * 1000;
const tokens = new CryptoSecureTokenProvider();

async function createUser(fields: Partial<IUser> = {}): Promise<IUser> {
  const user: IUser = {
    _id: newObjectId(),
    email: `email-${randomUUID()}@email.com`,
    name: 'Whitebeard',
    passwordHash: await bcrypt.hash(PASSWORD, LOW_COST_ROUNDS),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields,
  };
  await Muser.create(user);
  return user;
}

const post = (path: string, body: object) =>
  supertest(app.app).post(path).send(body);

describe('When a user signs up', () => {
  it('should start unverified, with a pending verification token', async () => {
    const email = `signup-${randomUUID()}@email.com`;

    const { body, statusCode } = await post('/users', {
      name: 'Whitebeard',
      email,
      password: PASSWORD,
    });

    expect(statusCode).toBe(201);
    expect(body.emailVerified).toBe(false);
    expect(body).not.toHaveProperty('emailVerificationTokenHash');
    const inDb = await Muser.findOne({ email }).lean();
    expect(inDb?.emailVerificationTokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(inDb?.emailVerificationExpiresAt?.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });
});

describe('When we confirm the e-mail with the link token', () => {
  it('should return 204, verify the e-mail and make the link single-use', async () => {
    const { token, hash } = tokens.generate();
    const user = await createUser({
      emailVerified: false,
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: new Date(Date.now() + ONE_HOUR),
    });

    const first = await post('/auth/verify-email', { token });
    const second = await post('/auth/verify-email', { token });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(422);
    expect(second.body.code).toBe('INVALID_VERIFICATION_TOKEN');
    const inDb = await Muser.findById(user._id).lean();
    expect(inDb?.emailVerified).toBe(true);
    expect(inDb).not.toHaveProperty('emailVerificationTokenHash');
  });

  it('should return 422 for an expired link', async () => {
    const { token, hash } = tokens.generate();
    await createUser({
      emailVerificationTokenHash: hash,
      emailVerificationExpiresAt: new Date(Date.now() - 1000),
    });

    const { body, statusCode } = await post('/auth/verify-email', { token });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_VERIFICATION_TOKEN');
  });
});

describe('When we reset a forgotten password', () => {
  it('should answer 204 for an unknown e-mail too, without revealing it', async () => {
    const { statusCode } = await post('/auth/forgot-password', {
      email: `nobody-${randomUUID()}@email.com`,
    });

    expect(statusCode).toBe(204);
  });

  it('should save a reset token for an existing account', async () => {
    const user = await createUser();

    const { statusCode } = await post('/auth/forgot-password', {
      email: user.email.toUpperCase(),
    });

    expect(statusCode).toBe(204);
    const inDb = await Muser.findById(user._id).lean();
    expect(inDb?.passwordResetTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should set the new password once, revoke old sessions and confirm the e-mail', async () => {
    const { token, hash } = tokens.generate();
    const user = await createUser({
      emailVerified: false,
      passwordResetTokenHash: hash,
      passwordResetExpiresAt: new Date(Date.now() + ONE_HOUR),
    });
    const { body: oldTokens } = await post('/auth/login', {
      email: user.email,
      password: PASSWORD,
    });

    const reset = await post('/auth/reset-password', {
      token,
      newPassword: 'newSecret456',
    });
    const reused = await post('/auth/reset-password', {
      token,
      newPassword: 'another789',
    });

    expect(reset.statusCode).toBe(204);
    expect(reused.statusCode).toBe(422);
    expect(reused.body.code).toBe('INVALID_RESET_TOKEN');
    const login = await post('/auth/login', {
      email: user.email,
      password: 'newSecret456',
    });
    expect(login.statusCode).toBe(200);
    const refresh = await post('/auth/refresh', {
      refreshToken: oldTokens.refreshToken,
    });
    expect(refresh.body.code).toBe('TOKEN_REVOKED');
    const inDb = await Muser.findById(user._id).lean();
    expect(inDb?.emailVerified).toBe(true);
    expect(inDb).not.toHaveProperty('passwordResetTokenHash');
  });

  it('should return 400 for a weak new password', async () => {
    const { statusCode } = await post('/auth/reset-password', {
      token: 'whatever',
      newPassword: 'short',
    });

    expect(statusCode).toBe(400);
  });

  it('should limit each IP to 5 requests every 15 minutes', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { statusCode } = await post('/auth/forgot-password', {
        email: `limit-${attempt}@email.com`,
      });
      statuses.push(statusCode);
    }

    expect(statuses).toContain(429);
  });
});

describe('When we ask for the e-mail confirmation again', () => {
  const resend = (userId: string) =>
    supertest(app.app)
      .post(`/users/${userId}/email-verification`)
      .set('Authorization', authHeaderFor(userId));

  it('should replace the pending token', async () => {
    const user = await createUser({
      emailVerified: false,
      emailVerificationTokenHash: 'old-hash',
      emailVerificationExpiresAt: new Date(Date.now() + ONE_HOUR),
    });

    const { statusCode } = await resend(user._id);

    expect(statusCode).toBe(204);
    const inDb = await Muser.findById(user._id).lean();
    expect(inDb?.emailVerificationTokenHash).not.toBe('old-hash');
  });

  it('should return 409 EMAIL_ALREADY_VERIFIED for a confirmed e-mail', async () => {
    const user = await createUser({ emailVerified: true });

    const { body, statusCode } = await resend(user._id);

    expect(statusCode).toBe(409);
    expect(body.code).toBe('EMAIL_ALREADY_VERIFIED');
  });

  it('should limit each user to 3 requests per hour', async () => {
    const user = await createUser({ emailVerified: false });

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await resend(user._id)).statusCode);
    }

    expect(statuses).toEqual([204, 204, 204, 429]);
  });
});
