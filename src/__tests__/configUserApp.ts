import path from 'path';
import { IAccountMailer } from '../domain/common/providers/account-mailer.provider';
import { IStorageProvider } from '../domain/common/providers/storage.provider';
import { CryptoSecureTokenProvider } from '../infrastructure/providers/secure-token/crypto.secure-token-provider';
import { UserService } from '../domain/user/service/user.service';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
import { SystemClock } from '../infrastructure/providers/clock/system.clock';
import { BcryptPasswordHasher } from '../infrastructure/providers/password-hasher/bcrypt.password-hasher';
import { MovieEntryRepositoryRead } from '../infrastructure/repository/movie-entry/movie-entry.repository.read';
import { MovieEntryRepositoryWrite } from '../infrastructure/repository/movie-entry/movie-entry.repository.write';
import { UserRepositoryRead } from '../infrastructure/repository/user/user.repository.read';
import { UserRepositoryWrite } from '../infrastructure/repository/user/user.repository.write';
import { WatchlistRepositoryWrite } from '../infrastructure/repository/watchlist/watchlist.repository.write';
import { UserController } from '../interfaces/http/controllers/user.controller';
import { authenticate } from '../interfaces/http/middlewares/auth.middleware';
import { Server } from '../interfaces/http/server';

const LOW_COST_ROUNDS = 4;

// configApp.ts wires the real Cloudinary provider; uploads in tests must not reach it.
export const fakeAccountMailer: jest.Mocked<IAccountMailer> = {
  sendEmailVerification: jest.fn(),
  sendPasswordReset: jest.fn(),
};

export const fakeUserStorageProvider: jest.Mocked<IStorageProvider> = {
  upload: jest.fn(),
  delete: jest.fn(),
};

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const userApp = new Server({
  port: 0,
  controllers: [
    new UserController(
      new UserService({
        userRepositoryRead: new UserRepositoryRead(),
        userRepositoryWrite: new UserRepositoryWrite(),
        movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
        movieEntryRepositoryWrite: new MovieEntryRepositoryWrite(),
        watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
        storageProvider: fakeUserStorageProvider,
        passwordHasher: new BcryptPasswordHasher(LOW_COST_ROUNDS),
        secureTokenProvider: new CryptoSecureTokenProvider(),
        accountMailer: fakeAccountMailer,
        clock: new SystemClock(),
      }),
      authenticate(TokenProviderFactory.create()),
      (_req, _res, next) => next(),
    ),
  ],
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});
