import { AuthService } from '../../../domain/auth/service/auth.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../repository/user/user.repository.write';
import { RevokedTokenRepositoryRead } from '../../repository/auth/revoked-token.repository.read';
import { RevokedTokenRepositoryWrite } from '../../repository/auth/revoked-token.repository.write';
import { SystemClock } from '../../providers/clock/system.clock';
import { CryptoSecureTokenProvider } from '../../providers/secure-token/crypto.secure-token-provider';
import { AccountMailerFactory } from './account-mailer.factory';
import { BcryptPasswordHasher } from '../../providers/password-hasher/bcrypt.password-hasher';
import { env } from '../env';
import { TokenProviderFactory } from './token.provider.factory';

export class AuthServiceFactory {
  static create() {
    return new AuthService({
      userRepositoryRead: new UserRepositoryRead(),
      userRepositoryWrite: new UserRepositoryWrite(),
      revokedTokenRepositoryRead: new RevokedTokenRepositoryRead(),
      revokedTokenRepositoryWrite: new RevokedTokenRepositoryWrite(),
      passwordHasher: new BcryptPasswordHasher(env.bcryptRounds),
      tokenProvider: TokenProviderFactory.create(),
      secureTokenProvider: new CryptoSecureTokenProvider(),
      accountMailer: AccountMailerFactory.create(),
      clock: new SystemClock(),
    });
  }
}
