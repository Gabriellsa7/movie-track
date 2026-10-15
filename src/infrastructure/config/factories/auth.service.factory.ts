import { AuthService } from '../../../domain/auth/service/auth.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { BcryptPasswordHasher } from '../../providers/password-hasher/bcrypt.password-hasher';
import { env } from '../env';
import { TokenProviderFactory } from './token.provider.factory';

export class AuthServiceFactory {
  static create() {
    return new AuthService({
      userRepositoryRead: new UserRepositoryRead(),
      passwordHasher: new BcryptPasswordHasher(env.bcryptRounds),
      tokenProvider: TokenProviderFactory.create(),
    });
  }
}
