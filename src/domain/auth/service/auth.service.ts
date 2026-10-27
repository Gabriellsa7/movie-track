import { Logger } from 'traceability';
import { IAccountMailer } from '../../common/providers/account-mailer.provider';
import { IClock } from '../../common/providers/clock.provider';
import { ISecureTokenProvider } from '../../common/providers/secure-token.provider';
import { UnprocessableEntityError } from '../../errors/unprocessable-entity.error';
import { IUserRepositoryWrite } from '../../user/repository/user.repository.write';
import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { ITokenProvider } from '../../common/providers/token.provider';
import { UnauthorizedError } from '../../errors/unauthorized.error';
import { IUser } from '../../user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { User } from '../../user/user.entity';
import {
  IAuthService,
  IParamsResetPassword,
  IAuthTokens,
  IParamsAuthService,
  IParamsLogin,
  IParamsRefreshToken,
} from '../interfaces/auth.service.interface';

const PASSWORD_RESET_TTL_MILLISECONDS = 60 * 60 * 1000;

export class AuthService implements IAuthService {
  private userRepositoryRead: IUserRepositoryRead;
  private userRepositoryWrite: IUserRepositoryWrite;
  private passwordHasher: IPasswordHasher;
  private tokenProvider: ITokenProvider;
  private secureTokenProvider: ISecureTokenProvider;
  private accountMailer: IAccountMailer;
  private clock: IClock;

  constructor({
    userRepositoryRead,
    userRepositoryWrite,
    passwordHasher,
    tokenProvider,
    secureTokenProvider,
    accountMailer,
    clock,
  }: IParamsAuthService) {
    this.userRepositoryRead = userRepositoryRead;
    this.userRepositoryWrite = userRepositoryWrite;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
    this.secureTokenProvider = secureTokenProvider;
    this.accountMailer = accountMailer;
    this.clock = clock;
  }

  @ErrorHandler()
  async login(params: IParamsLogin): Promise<IAuthTokens> {
    const user = await this.userRepositoryRead.findUserByEmail(
      User.normalizeEmail(params.email),
    );
    if (!user) {
      throw this.invalidCredentialsError();
    }

    const matches = await this.passwordHasher.compare(
      params.password,
      user.passwordHash,
    );
    if (!matches) {
      throw this.invalidCredentialsError();
    }

    return this.issueTokens(user);
  }

  @ErrorHandler()
  async refresh(params: IParamsRefreshToken): Promise<IAuthTokens> {
    const { sub, sessionVersion = 0 } = this.tokenProvider.verifyRefreshToken(
      params.refreshToken,
    );

    const user = await this.userRepositoryRead.findUserById(sub);
    if (!user) {
      throw new UnauthorizedError('Invalid token', 'INVALID_TOKEN');
    }
    if (sessionVersion !== (user.sessionVersion ?? 0)) {
      throw new UnauthorizedError(
        'Token revoked by a password change',
        'TOKEN_REVOKED',
      );
    }

    return this.issueTokens(user);
  }

  @ErrorHandler()
  async verifyEmail(token: string): Promise<void> {
    const existingUser =
      await this.userRepositoryRead.findUserByEmailVerificationTokenHash(
        this.secureTokenProvider.hash(token),
      );
    const now = this.clock.now();
    if (!existingUser || this.isExpired(existingUser.emailVerificationExpiresAt, now)) {
      throw new UnprocessableEntityError(
        'The verification link is invalid or expired',
        'INVALID_VERIFICATION_TOKEN',
      );
    }

    const user = new User(existingUser);
    user.confirmEmail(now);
    await this.userRepositoryWrite.updateUserById(existingUser._id, {
      emailVerified: user.emailVerified,
      emailVerificationTokenHash: user.emailVerificationTokenHash,
      emailVerificationExpiresAt: user.emailVerificationExpiresAt,
      updatedAt: user.updatedAt,
    });
  }

  // Answers the same whether the e-mail exists or not, so it cannot be used to find accounts.
  @ErrorHandler()
  async requestPasswordReset(email: string): Promise<void> {
    const existingUser = await this.userRepositoryRead.findUserByEmail(
      User.normalizeEmail(email),
    );
    if (!existingUser) {
      return;
    }

    const user = new User(existingUser);
    const { token, hash } = this.secureTokenProvider.generate();
    user.startPasswordReset(
      hash,
      new Date(this.clock.now().getTime() + PASSWORD_RESET_TTL_MILLISECONDS),
    );
    await this.userRepositoryWrite.updateUserById(existingUser._id, {
      passwordResetTokenHash: user.passwordResetTokenHash,
      passwordResetExpiresAt: user.passwordResetExpiresAt,
    });

    // A failure must not answer differently from an unknown e-mail, so it is only logged.
    try {
      await this.accountMailer.sendPasswordReset({
        to: user.email,
        name: user.name,
        token,
      });
    } catch (error) {
      Logger.warn('Failed to send the password reset e-mail', {
        eventName: 'auth.password_reset.send_failed',
        userId: existingUser._id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  @ErrorHandler()
  async resetPassword(params: IParamsResetPassword): Promise<void> {
    const existingUser =
      await this.userRepositoryRead.findUserByPasswordResetTokenHash(
        this.secureTokenProvider.hash(params.token),
      );
    const now = this.clock.now();
    if (!existingUser || this.isExpired(existingUser.passwordResetExpiresAt, now)) {
      throw new UnprocessableEntityError(
        'The password reset link is invalid or expired',
        'INVALID_RESET_TOKEN',
      );
    }

    const user = new User(existingUser);
    user.resetPassword(await this.passwordHasher.hash(params.newPassword), now);
    await this.userRepositoryWrite.updateUserById(existingUser._id, {
      passwordHash: user.passwordHash,
      sessionVersion: user.sessionVersion,
      passwordResetTokenHash: user.passwordResetTokenHash,
      passwordResetExpiresAt: user.passwordResetExpiresAt,
      emailVerified: user.emailVerified,
      emailVerificationTokenHash: user.emailVerificationTokenHash,
      emailVerificationExpiresAt: user.emailVerificationExpiresAt,
      updatedAt: user.updatedAt,
    });
  }

  private isExpired(expiresAt: Date | undefined, now: Date): boolean {
    return !expiresAt || expiresAt.getTime() <= now.getTime();
  }

  private issueTokens(user: IUser): IAuthTokens {
    return {
      accessToken: this.tokenProvider.generateAccessToken({ sub: user._id }),
      refreshToken: this.tokenProvider.generateRefreshToken({
        sub: user._id,
        sessionVersion: user.sessionVersion ?? 0,
      }),
    };
  }

  private invalidCredentialsError(): UnauthorizedError {
    return new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
  }
}
