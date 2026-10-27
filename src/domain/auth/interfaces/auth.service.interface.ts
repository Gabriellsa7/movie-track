import { IAccountMailer } from '../../common/providers/account-mailer.provider';
import { IClock } from '../../common/providers/clock.provider';
import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { ISecureTokenProvider } from '../../common/providers/secure-token.provider';
import { ITokenProvider } from '../../common/providers/token.provider';
import { IRevokedTokenRepositoryRead } from '../repository/revoked-token.repository.read';
import { IRevokedTokenRepositoryWrite } from '../repository/revoked-token.repository.write';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IUserRepositoryWrite } from '../../user/repository/user.repository.write';

export interface IParamsLogin {
  email: string;
  password: string;
}

export interface IParamsRefreshToken {
  refreshToken: string;
}

export interface IParamsResetPassword {
  token: string;
  newPassword: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IParamsAuthService {
  userRepositoryRead: IUserRepositoryRead;
  userRepositoryWrite: IUserRepositoryWrite;
  revokedTokenRepositoryRead: IRevokedTokenRepositoryRead;
  revokedTokenRepositoryWrite: IRevokedTokenRepositoryWrite;
  passwordHasher: IPasswordHasher;
  tokenProvider: ITokenProvider;
  secureTokenProvider: ISecureTokenProvider;
  accountMailer: IAccountMailer;
  clock: IClock;
}

export interface IAuthService {
  login(params: IParamsLogin): Promise<IAuthTokens>;
  refresh(params: IParamsRefreshToken): Promise<IAuthTokens>;
  logout(params: IParamsRefreshToken): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  resetPassword(params: IParamsResetPassword): Promise<void>;
}
