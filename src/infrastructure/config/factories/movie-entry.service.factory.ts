import { MovieEntryService } from '../../../domain/movie-entry/service/movie-entry.service';
import { GenreRepositoryRead } from '../../repository/genre/genre.repository.read';
import { MovieEntryRepositoryRead } from '../../repository/movie-entry/movie-entry.repository.read';
import { MovieEntryRepositoryWrite } from '../../repository/movie-entry/movie-entry.repository.write';
import { WatchlistRepositoryRead } from '../../repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../../repository/watchlist/watchlist.repository.write';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { SystemClock } from '../../providers/clock/system.clock';
import { StorageProviderFactory } from './storage.provider.factory';

export class MovieEntryServiceFactory {
  static create() {
    return new MovieEntryService({
      movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
      movieEntryRepositoryWrite: new MovieEntryRepositoryWrite(),
      genreRepositoryRead: new GenreRepositoryRead(),
      watchlistRepositoryRead: new WatchlistRepositoryRead(),
      watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
      userRepositoryRead: new UserRepositoryRead(),
      storageProvider: StorageProviderFactory.create(),
      clock: new SystemClock(),
    });
  }
}
