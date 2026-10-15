import { AuthService } from '../../../domain/auth/service/auth.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { BcryptPasswordHasher } from '../../providers/password-hasher/bcrypt.password-hasher';
import { JwtTokenProvider } from '../../providers/token/jwt.token-provider';
import { env } from '../env';

export class AuthServiceFactory {
  static create() {
    return new AuthService({
      userRepositoryRead: new UserRepositoryRead(),
      passwordHasher: new BcryptPasswordHasher(env.bcryptRounds),
      tokenProvider: new JwtTokenProvider({
        accessTokenSecret: env.jwtSecret,
        accessTokenExpiresIn: env.jwtExpiresIn,
        refreshTokenSecret: env.refreshTokenSecret,
        refreshTokenExpiresIn: env.refreshTokenExpiresIn,
      }),
    });
  }
}
