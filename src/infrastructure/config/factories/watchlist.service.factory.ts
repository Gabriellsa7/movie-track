import { WatchlistService } from '../../../domain/watchlist/service/watchlist.service';
import { WatchlistRepositoryRead } from '../../repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../../repository/watchlist/watchlist.repository.write';
import { SystemClock } from '../../providers/clock/system.clock';

export class WatchlistServiceFactory {
  static create() {
    return new WatchlistService({
      watchlistRepositoryRead: new WatchlistRepositoryRead(),
      watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
      clock: new SystemClock(),
    });
  }
}
