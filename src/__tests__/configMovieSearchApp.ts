import path from 'path';
import { IMovieCatalogProvider } from '../domain/common/providers/movie-catalog.provider';
import { MovieSearchService } from '../domain/movie-search/service/movie-search.service';
import { TokenProviderFactory } from '../infrastructure/config/factories/token.provider.factory';
import { GenreRepositoryRead } from '../infrastructure/repository/genre/genre.repository.read';
import { MovieSearchController } from '../interfaces/http/controllers/movie-search.controller';
import { authenticate } from '../interfaces/http/middlewares/auth.middleware';
import { Server } from '../interfaces/http/server';

// configApp.ts wires the real TMDB provider; tests must not depend on the network.
export const fakeMovieCatalogProvider: jest.Mocked<IMovieCatalogProvider> = {
  searchMovies: jest.fn(),
};

const OPEN_API_SPEC_FILE_LOCATION = path.resolve(
  __dirname,
  '../contracts/service.yaml',
);

export const movieSearchApp = new Server({
  port: 0,
  controllers: [
    new MovieSearchController(
      new MovieSearchService({
        movieCatalogProvider: fakeMovieCatalogProvider,
        genreRepositoryRead: new GenreRepositoryRead(),
      }),
      authenticate(TokenProviderFactory.create()),
    ),
  ],
  apiSpecLocation: OPEN_API_SPEC_FILE_LOCATION,
});
