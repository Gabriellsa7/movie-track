import { AuthService } from '../../domain/auth/service/auth.service';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { IPasswordHasher } from '../../domain/common/providers/password-hasher.provider';
import { ITokenProvider } from '../../domain/common/providers/token.provider';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';
import { IUserRepositoryWrite } from '../../domain/user/repository/user.repository.write';
import { ISecureTokenProvider } from '../../domain/common/providers/secure-token.provider';
import { IAccountMailer } from '../../domain/common/providers/account-mailer.provider';
import { IRevokedTokenRepositoryRead } from '../../domain/auth/repository/revoked-token.repository.read';
import { IRevokedTokenRepositoryWrite } from '../../domain/auth/repository/revoked-token.repository.write';
import { Logger } from 'traceability';

const NOW = new Date('2026-02-01T12:00:00.000Z');
const ONE_HOUR = 60 * 60 * 1000;

const REFRESH_TOKEN_EXPIRES_AT = new Date('2026-02-08T12:00:00.000Z');
const REFRESH_CLAIMS = {
  tokenId: 'token-id-1',
  expiresAt: REFRESH_TOKEN_EXPIRES_AT,
};

const A_USER: IUser = {
  _id: 'user-1',
  name: 'Whitebeard',
  email: 'whitebeard@email.com',
  passwordHash: 'hashed-secret123',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

let userRepositoryRead: jest.Mocked<IUserRepositoryRead>;
let passwordHasher: jest.Mocked<IPasswordHasher>;
let tokenProvider: jest.Mocked<ITokenProvider>;
let userRepositoryWrite: jest.Mocked<IUserRepositoryWrite>;
let secureTokenProvider: jest.Mocked<ISecureTokenProvider>;
let accountMailer: jest.Mocked<IAccountMailer>;
let revokedTokenRepositoryRead: jest.Mocked<IRevokedTokenRepositoryRead>;
let revokedTokenRepositoryWrite: jest.Mocked<IRevokedTokenRepositoryWrite>;
let authService: AuthService;

beforeEach(() => {
  userRepositoryRead = {
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    findUserByEmailVerificationTokenHash: jest.fn(),
    findUserByPasswordResetTokenHash: jest.fn(),
    searchUsers: jest.fn(),
    countUsers: jest.fn(),
  };
  userRepositoryWrite = {
    createUser: jest.fn(),
    updateUserById: jest.fn(async (id, userData) => ({ ...A_USER, ...userData })),
    deleteUserById: jest.fn(),
  };
  secureTokenProvider = {
    generate: jest.fn(() => ({ token: 'plain-token', hash: 'hashed-token' })),
    hash: jest.fn((token: string) => `hashed-${token}`),
  };
  accountMailer = {
    sendEmailVerification: jest.fn(),
    sendPasswordReset: jest.fn(),
  };
  revokedTokenRepositoryRead = {
    isTokenRevoked: jest.fn().mockResolvedValue(false),
  };
  revokedTokenRepositoryWrite = { revokeToken: jest.fn() };
  passwordHasher = { hash: jest.fn(), compare: jest.fn() };
  tokenProvider = {
    generateAccessToken: jest.fn(({ sub }) => `access-${sub}`),
    verifyAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(
      ({ sub, sessionVersion }) => `refresh-${sub}-v${sessionVersion}`,
    ),
    verifyRefreshToken: jest.fn(),
  };
  authService = new AuthService({
    userRepositoryRead,
    userRepositoryWrite,
    revokedTokenRepositoryRead,
    revokedTokenRepositoryWrite,
    passwordHasher,
    tokenProvider,
    secureTokenProvider,
    accountMailer,
    clock: { now: () => NOW },
  });
});

describe('When we log in', () => {
  it('should return access and refresh tokens for valid credentials', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(true);

    const tokens = await authService.login({
      email: ' WhiteBeard@Email.com ',
      password: 'secret123',
    });

    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      'whitebeard@email.com',
    );
    expect(passwordHasher.compare).toHaveBeenCalledWith(
      'secret123',
      A_USER.passwordHash,
    );
    expect(tokens).toEqual({
      accessToken: 'access-user-1',
      refreshToken: 'refresh-user-1-v0',
    });
  });

  it("should put the user's session version in the refresh token", async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue({
      ...A_USER,
      sessionVersion: 2,
    });
    passwordHasher.compare.mockResolvedValue(true);

    const tokens = await authService.login({
      email: A_USER.email,
      password: 'secret123',
    });

    expect(tokens.refreshToken).toBe('refresh-user-1-v2');
  });

  it('should reject an unknown email with invalid credentials', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'nobody@email.com', password: 'secret123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('should reject a wrong password with invalid credentials', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(
      authService.login({ email: A_USER.email, password: 'wrong123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(tokenProvider.generateAccessToken).not.toHaveBeenCalled();
  });
});

describe('When we refresh the tokens', () => {
  it('should issue new tokens for an existing user', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({ ...REFRESH_CLAIMS, sub: A_USER._id });
    userRepositoryRead.findUserById.mockResolvedValue(A_USER);

    const tokens = await authService.refresh({ refreshToken: 'valid-refresh' });

    expect(tokenProvider.verifyRefreshToken).toHaveBeenCalledWith(
      'valid-refresh',
    );
    expect(tokens).toEqual({
      accessToken: 'access-user-1',
      refreshToken: 'refresh-user-1-v0',
    });
  });

  it('should accept a token with the current session version', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({
      ...REFRESH_CLAIMS,
      sub: A_USER._id,
      sessionVersion: 2,
    });
    userRepositoryRead.findUserById.mockResolvedValue({
      ...A_USER,
      sessionVersion: 2,
    });

    const tokens = await authService.refresh({ refreshToken: 'valid-refresh' });

    expect(tokens.refreshToken).toBe('refresh-user-1-v2');
  });

  it('should reject a token issued before a password change with TOKEN_REVOKED', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({
      ...REFRESH_CLAIMS,
      sub: A_USER._id,
      sessionVersion: 1,
    });
    userRepositoryRead.findUserById.mockResolvedValue({
      ...A_USER,
      sessionVersion: 2,
    });

    await expect(
      authService.refresh({ refreshToken: 'old-refresh' }),
    ).rejects.toMatchObject({ status: 401, code: 'TOKEN_REVOKED' });
    expect(tokenProvider.generateRefreshToken).not.toHaveBeenCalled();
  });

  it('should reject a token without a version once the password changed', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({ ...REFRESH_CLAIMS, sub: A_USER._id });
    userRepositoryRead.findUserById.mockResolvedValue({
      ...A_USER,
      sessionVersion: 1,
    });

    await expect(
      authService.refresh({ refreshToken: 'legacy-refresh' }),
    ).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
  });

  it('should reject a refresh token of a deleted user', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({ ...REFRESH_CLAIMS, sub: 'deleted-user' });
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(
      authService.refresh({ refreshToken: 'valid-refresh' }),
    ).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('should propagate the error of an invalid refresh token', async () => {
    tokenProvider.verifyRefreshToken.mockImplementation(() => {
      throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    });

    await expect(
      authService.refresh({ refreshToken: 'expired-refresh' }),
    ).rejects.toMatchObject({ code: 'TOKEN_EXPIRED' });
    expect(userRepositoryRead.findUserById).not.toHaveBeenCalled();
  });

  it('should reject a token revoked by a logout with TOKEN_REVOKED', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({
      ...REFRESH_CLAIMS,
      sub: A_USER._id,
    });
    revokedTokenRepositoryRead.isTokenRevoked.mockResolvedValue(true);

    await expect(
      authService.refresh({ refreshToken: 'logged-out-refresh' }),
    ).rejects.toMatchObject({ status: 401, code: 'TOKEN_REVOKED' });
    expect(revokedTokenRepositoryRead.isTokenRevoked).toHaveBeenCalledWith(
      'token-id-1',
    );
    expect(tokenProvider.generateRefreshToken).not.toHaveBeenCalled();
  });
});

describe('When we log out', () => {
  it('should revoke the refresh token until it would expire', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({
      ...REFRESH_CLAIMS,
      sub: A_USER._id,
    });

    await authService.logout({ refreshToken: 'valid-refresh' });

    expect(tokenProvider.verifyRefreshToken).toHaveBeenCalledWith(
      'valid-refresh',
    );
    expect(revokedTokenRepositoryWrite.revokeToken).toHaveBeenCalledWith({
      tokenId: 'token-id-1',
      expiresAt: REFRESH_TOKEN_EXPIRES_AT,
    });
  });

  it('should do nothing for an expired refresh token', async () => {
    tokenProvider.verifyRefreshToken.mockImplementation(() => {
      throw new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    });

    await expect(
      authService.logout({ refreshToken: 'expired-refresh' }),
    ).resolves.toBeUndefined();
    expect(revokedTokenRepositoryWrite.revokeToken).not.toHaveBeenCalled();
  });

  it('should reject an invalid refresh token with INVALID_TOKEN', async () => {
    tokenProvider.verifyRefreshToken.mockImplementation(() => {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    });

    await expect(
      authService.logout({ refreshToken: 'forged-refresh' }),
    ).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
    expect(revokedTokenRepositoryWrite.revokeToken).not.toHaveBeenCalled();
  });
});

describe('When we confirm an e-mail', () => {
  it('should mark it verified and clear the token', async () => {
    userRepositoryRead.findUserByEmailVerificationTokenHash.mockResolvedValue({
      ...A_USER,
      emailVerified: false,
      emailVerificationTokenHash: 'hashed-plain-token',
      emailVerificationExpiresAt: new Date(NOW.getTime() + ONE_HOUR),
    });

    await authService.verifyEmail('plain-token');

    expect(
      userRepositoryRead.findUserByEmailVerificationTokenHash,
    ).toHaveBeenCalledWith('hashed-plain-token');
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      emailVerified: true,
      emailVerificationTokenHash: undefined,
      emailVerificationExpiresAt: undefined,
      updatedAt: NOW,
    });
  });

  it('should reject an unknown token with INVALID_VERIFICATION_TOKEN', async () => {
    userRepositoryRead.findUserByEmailVerificationTokenHash.mockResolvedValue(
      null,
    );

    await expect(authService.verifyEmail('unknown')).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_VERIFICATION_TOKEN',
    });
    expect(userRepositoryWrite.updateUserById).not.toHaveBeenCalled();
  });

  it('should reject an expired token', async () => {
    userRepositoryRead.findUserByEmailVerificationTokenHash.mockResolvedValue({
      ...A_USER,
      emailVerificationTokenHash: 'hashed-plain-token',
      emailVerificationExpiresAt: NOW,
    });

    await expect(authService.verifyEmail('plain-token')).rejects.toMatchObject({
      code: 'INVALID_VERIFICATION_TOKEN',
    });
  });
});

describe('When we ask for a password reset', () => {
  it('should save the token hash for 1 hour and e-mail the plain token', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);

    await authService.requestPasswordReset(' WhiteBeard@Email.com ');

    expect(userRepositoryRead.findUserByEmail).toHaveBeenCalledWith(
      'whitebeard@email.com',
    );
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      passwordResetTokenHash: 'hashed-token',
      passwordResetExpiresAt: new Date(NOW.getTime() + ONE_HOUR),
    });
    expect(accountMailer.sendPasswordReset).toHaveBeenCalledWith({
      to: A_USER.email,
      name: A_USER.name,
      token: 'plain-token',
    });
  });

  it('should do nothing, without failing, for an unknown e-mail', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(null);

    await expect(
      authService.requestPasswordReset('nobody@email.com'),
    ).resolves.toBeUndefined();
    expect(accountMailer.sendPasswordReset).not.toHaveBeenCalled();
  });

  it('should only log when the e-mail cannot be sent', async () => {
    userRepositoryRead.findUserByEmail.mockResolvedValue(A_USER);
    accountMailer.sendPasswordReset.mockRejectedValue(new Error('Resend down'));
    const warnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => Logger);

    await expect(
      authService.requestPasswordReset(A_USER.email),
    ).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Failed to send the password reset e-mail',
      expect.objectContaining({ eventName: 'auth.password_reset.send_failed' }),
    );
    warnSpy.mockRestore();
  });
});

describe('When we reset the password with a token', () => {
  const WITH_RESET_TOKEN: IUser = {
    ...A_USER,
    sessionVersion: 2,
    emailVerified: false,
    emailVerificationTokenHash: 'pending-verification',
    emailVerificationExpiresAt: new Date(NOW.getTime() + ONE_HOUR),
    passwordResetTokenHash: 'hashed-plain-token',
    passwordResetExpiresAt: new Date(NOW.getTime() + ONE_HOUR),
  };

  it('should save the new hash, revoke sessions, clear the token and confirm the e-mail', async () => {
    userRepositoryRead.findUserByPasswordResetTokenHash.mockResolvedValue(
      WITH_RESET_TOKEN,
    );
    passwordHasher.hash.mockResolvedValue('hashed-newSecret456');

    await authService.resetPassword({
      token: 'plain-token',
      newPassword: 'newSecret456',
    });

    expect(passwordHasher.hash).toHaveBeenCalledWith('newSecret456');
    expect(userRepositoryWrite.updateUserById).toHaveBeenCalledWith(A_USER._id, {
      passwordHash: 'hashed-newSecret456',
      sessionVersion: 3,
      passwordResetTokenHash: undefined,
      passwordResetExpiresAt: undefined,
      emailVerified: true,
      emailVerificationTokenHash: undefined,
      emailVerificationExpiresAt: undefined,
      updatedAt: NOW,
    });
  });

  it('should reject an unknown or expired token with INVALID_RESET_TOKEN', async () => {
    userRepositoryRead.findUserByPasswordResetTokenHash.mockResolvedValueOnce(
      null,
    );
    userRepositoryRead.findUserByPasswordResetTokenHash.mockResolvedValueOnce({
      ...WITH_RESET_TOKEN,
      passwordResetExpiresAt: new Date(NOW.getTime() - 1),
    });
    const params = { token: 'plain-token', newPassword: 'newSecret456' };

    await expect(authService.resetPassword(params)).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_RESET_TOKEN',
    });
    await expect(authService.resetPassword(params)).rejects.toMatchObject({
      code: 'INVALID_RESET_TOKEN',
    });
    expect(userRepositoryWrite.updateUserById).not.toHaveBeenCalled();
  });
});
