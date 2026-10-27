import { WatchlistService } from '../../../domain/watchlist/service/watchlist.service';
import { WatchlistRepositoryRead } from '../../repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../../repository/watchlist/watchlist.repository.write';
import { MovieEntryRepositoryRead } from '../../repository/movie-entry/movie-entry.repository.read';
import { UserRepositoryRead } from '../../repository/user/user.repository.read';
import { SystemClock } from '../../providers/clock/system.clock';

export class WatchlistServiceFactory {
  static create() {
    return new WatchlistService({
      watchlistRepositoryRead: new WatchlistRepositoryRead(),
      watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
      movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
      userRepositoryRead: new UserRepositoryRead(),
      clock: new SystemClock(),
    });
  }
}
