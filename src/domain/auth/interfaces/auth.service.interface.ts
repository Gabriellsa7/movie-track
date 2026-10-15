import { IPasswordHasher } from '../../common/providers/password-hasher.provider';
import { ITokenProvider } from '../../common/providers/token.provider';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';

export interface IParamsLogin {
  email: string;
  password: string;
}

export interface IParamsRefreshToken {
  refreshToken: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface IParamsAuthService {
  userRepositoryRead: IUserRepositoryRead;
  passwordHasher: IPasswordHasher;
  tokenProvider: ITokenProvider;
}

export interface IAuthService {
  login(params: IParamsLogin): Promise<IAuthTokens>;
  refresh(params: IParamsRefreshToken): Promise<IAuthTokens>;
}
