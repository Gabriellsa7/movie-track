import { ITokenProvider } from '../../../domain/common/providers/token.provider';
import { JwtTokenProvider } from '../../providers/token/jwt.token-provider';
import { env } from '../env';

export class TokenProviderFactory {
  static create(): ITokenProvider {
    return new JwtTokenProvider({
      accessTokenSecret: env.jwtSecret,
      accessTokenExpiresIn: env.jwtExpiresIn,
      refreshTokenSecret: env.refreshTokenSecret,
      refreshTokenExpiresIn: env.refreshTokenExpiresIn,
    });
  }
}
