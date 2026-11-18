import path from 'path';
import { IStorageProvider } from '../domain/common/providers/storage.provider';
import { WatchlistService } from '../domain/watchlist/service/watchlist.service';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
import { SystemClock } from '../infrastructure/providers/clock/system.clock';
import { GenreRepositoryRead } from '../infrastructure/repository/genre/genre.repository.read';
import { MovieEntryRepositoryRead } from '../infrastructure/repository/movie-entry/movie-entry.repository.read';
import { UserRepositoryRead } from '../infrastructure/repository/user/user.repository.read';
import { WatchlistRepositoryRead } from '../infrastructure/repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../infrastructure/repository/watchlist/watchlist.repository.write';
import { WatchlistController } from '../interfaces/http/controllers/watchlist.controller';
import { authenticate } from '../interfaces/http/middlewares/auth.middleware';
import { Server } from '../interfaces/http/server';

export const fakeWatchlistStorageProvider: jest.Mocked<IStorageProvider> = {
  upload: jest.fn(),
  delete: jest.fn(),
};

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const watchlistApp = new Server({
  port: 0,
  controllers: [
    new WatchlistController(
      new WatchlistService({
        watchlistRepositoryRead: new WatchlistRepositoryRead(),
        watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
        movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
        userRepositoryRead: new UserRepositoryRead(),
        genreRepositoryRead: new GenreRepositoryRead(),
        storageProvider: fakeWatchlistStorageProvider,
        clock: new SystemClock(),
      }),
      authenticate(TokenProviderFactory.create()),
    ),
  ],
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});
