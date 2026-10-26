import { UserService } from '../../../domain/user/service/user.service';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { UserRepositoryWrite } from '../../repository/user/user.repository.write';
import { BcryptPasswordHasher } from '../../providers/password-hasher/bcrypt.password-hasher';
import { SystemClock } from '../../providers/clock/system.clock';
import { MovieEntryRepositoryRead } from '../../repository/movie-entry/movie-entry.repository.read';
import { MovieEntryRepositoryWrite } from '../../repository/movie-entry/movie-entry.repository.write';
import { WatchlistRepositoryWrite } from '../../repository/watchlist/watchlist.repository.write';
import { StorageProviderFactory } from './storage.provider.factory';
import { env } from '../env';

export class UserServiceFactory {
  static create() {
    const repoRead = new UserRepositoryRead();
    const repoWrite = new UserRepositoryWrite();

    return new UserService({
      userRepositoryRead: repoRead,
      userRepositoryWrite: repoWrite,
      movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
      movieEntryRepositoryWrite: new MovieEntryRepositoryWrite(),
      watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
      storageProvider: StorageProviderFactory.create(),
      passwordHasher: new BcryptPasswordHasher(env.bcryptRounds),
      clock: new SystemClock(),
    });
  }
}
