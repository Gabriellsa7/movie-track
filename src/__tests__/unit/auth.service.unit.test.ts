import { AuthService } from '../../domain/auth/service/auth.service';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { IUser } from '../../domain/user/interfaces/user.interface';
import { IPasswordHasher } from '../../domain/common/providers/password-hasher.provider';
import { ITokenProvider } from '../../domain/common/providers/token.provider';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';

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
let authService: AuthService;

beforeEach(() => {
  userRepositoryRead = {
    findUserById: jest.fn(),
    findUserByEmail: jest.fn(),
    searchUsers: jest.fn(),
    countUsers: jest.fn(),
  };
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
    passwordHasher,
    tokenProvider,
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
    tokenProvider.verifyRefreshToken.mockReturnValue({ sub: A_USER._id });
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
    tokenProvider.verifyRefreshToken.mockReturnValue({ sub: A_USER._id });
    userRepositoryRead.findUserById.mockResolvedValue({
      ...A_USER,
      sessionVersion: 1,
    });

    await expect(
      authService.refresh({ refreshToken: 'legacy-refresh' }),
    ).rejects.toMatchObject({ code: 'TOKEN_REVOKED' });
  });

  it('should reject a refresh token of a deleted user', async () => {
    tokenProvider.verifyRefreshToken.mockReturnValue({ sub: 'deleted-user' });
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
});
