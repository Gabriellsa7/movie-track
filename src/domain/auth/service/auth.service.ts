import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { ITokenProvider } from '../../common/providers/token.provider';
import { UnauthorizedError } from '../../errors/unauthorized.error';
import { IUser } from '../../user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { User } from '../../user/user.entity';
import {
  IAuthService,
  IAuthTokens,
  IParamsAuthService,
  IParamsLogin,
  IParamsRefreshToken,
} from '../interfaces/auth.service.interface';

export class AuthService implements IAuthService {
  private userRepositoryRead: IUserRepositoryRead;
  private passwordHasher: IPasswordHasher;
  private tokenProvider: ITokenProvider;

  constructor({
    userRepositoryRead,
    passwordHasher,
    tokenProvider,
  }: IParamsAuthService) {
    this.userRepositoryRead = userRepositoryRead;
    this.passwordHasher = passwordHasher;
    this.tokenProvider = tokenProvider;
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
