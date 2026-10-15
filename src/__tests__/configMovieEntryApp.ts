import path from 'path';
import supertest from 'supertest';
import { IStorageProvider } from '../domain/common/providers/storage.provider';
import { IGenre } from '../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryRead } from '../domain/genre/repository/genre.repository.read';
import { MovieEntryService } from '../domain/movie-entry/service/movie-entry.service';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
import { SystemClock } from '../infrastructure/providers/clock/system.clock';
import { MovieEntryRepositoryRead } from '../infrastructure/repository/movie-entry/movie-entry.repository.read';
import { MovieEntryRepositoryWrite } from '../infrastructure/repository/movie-entry/movie-entry.repository.write';
import { WatchlistRepositoryRead } from '../infrastructure/repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../infrastructure/repository/watchlist/watchlist.repository.write';
import { MovieEntryController } from '../interfaces/http/controllers/movie-entry.controller';
import { authenticate } from '../interfaces/http/middlewares/auth.middleware';
import { Server } from '../interfaces/http/server';
import { authHeaderFor, newObjectId } from './testUtils';

// Genre (phase 3) and storage (phase 4) have no implementation yet, so this app
// wires the real movie-entry stack with in-memory fakes for them. Once those
// exist, register MovieEntryControllerFactory in configApp.ts and drop this file.

export const KNOWN_GENRES: IGenre[] = [
  { _id: newObjectId(), name: 'Drama', tmdbGenreId: 18 },
  { _id: newObjectId(), name: 'Comédia', tmdbGenreId: 35 },
];

const fakeGenreRepositoryRead: IGenreRepositoryRead = {
  listGenres: async () => KNOWN_GENRES,
  findGenresByIds: async (ids) =>
    KNOWN_GENRES.filter((genre) => ids.includes(genre._id)),
  findGenresByTmdbIds: async (tmdbGenreIds) =>
    KNOWN_GENRES.filter((genre) => tmdbGenreIds.includes(genre.tmdbGenreId)),
};

export const fakeStorageProvider: jest.Mocked<IStorageProvider> = {
  upload: jest.fn(),
  delete: jest.fn(),
};

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const movieEntryApp = new Server({
  port: 0,
  controllers: [
    new MovieEntryController(
      new MovieEntryService({
        movieEntryRepositoryRead: new MovieEntryRepositoryRead(),
        movieEntryRepositoryWrite: new MovieEntryRepositoryWrite(),
        genreRepositoryRead: fakeGenreRepositoryRead,
        watchlistRepositoryRead: new WatchlistRepositoryRead(),
        watchlistRepositoryWrite: new WatchlistRepositoryWrite(),
        storageProvider: fakeStorageProvider,
        clock: new SystemClock(),
      }),
      authenticate(TokenProviderFactory.create()),
    ),
  ],
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});

export async function createMovieFor(
  userId: string,
  overrides: object = {},
): Promise<Record<string, unknown> & { id: string }> {
  const { body } = await supertest(movieEntryApp.app)
    .post('/movies')
    .set('Authorization', authHeaderFor(userId))
    .send({
      title: `Movie ${newObjectId()}`,
      synopsis: 'A synopsis.',
      releaseYear: 2000,
      genreIds: [KNOWN_GENRES[0]._id],
      rating: 7,
      ...overrides,
    });
  return body;
}
