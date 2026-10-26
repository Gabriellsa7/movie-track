import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { ServiceUnavailableError } from '../../domain/errors/service-unavailable.error';
import { GenreSeedFactory } from '../../infrastructure/config/factories/genre.seed.factory';
import { Mgenre } from '../../infrastructure/db/mongo/models/genre.model';
import {
  fakeMovieCatalogProvider,
  movieSearchApp,
} from '../configMovieSearchApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const search = (query: Record<string, string | number>) =>
  supertest(movieSearchApp.app)
    .get('/tmdb/search')
    .query(query)
    .set('Authorization', authHeaderFor(newObjectId()));

let dramaId: string;

beforeAll(async () => {
  await GenreSeedFactory.create().run();
  const drama = await Mgenre.findOne({ tmdbGenreId: 18 }).lean();
  dramaId = drama!._id.toString();
});

beforeEach(() => {
  fakeMovieCatalogProvider.searchMovies.mockReset();
  fakeMovieCatalogProvider.searchMovies.mockResolvedValue({
    items: [
      {
        tmdbId: 598,
        title: 'Cidade de Deus',
        originalTitle: 'Cidade de Deus',
        synopsis: 'Buscapé cresce na Cidade de Deus.',
        releaseYear: 2002,
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        tmdbGenreIds: [18, 99999],
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  });
});

describe('When we search a movie in TMDB', () => {
  it('should return 200 with our genre ids in the contract shape', async () => {
    const { body, statusCode } = await search({ query: 'cidade de deus' });

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      items: [
        {
          tmdbId: 598,
          title: 'Cidade de Deus',
          originalTitle: 'Cidade de Deus',
          synopsis: 'Buscapé cresce na Cidade de Deus.',
          releaseYear: 2002,
          posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          genreIds: [dramaId],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it('should ask the catalog for the first page by default', async () => {
    await search({ query: 'cidade' });

    expect(fakeMovieCatalogProvider.searchMovies).toHaveBeenCalledWith({
      query: 'cidade',
      page: 1,
    });
  });
});

describe('When we search with invalid parameters', () => {
  it('should return 400 without a query', async () => {
    const { body, statusCode } = await search({});

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 for a blank query', async () => {
    const { statusCode } = await search({ query: '   ' });

    expect(statusCode).toBe(400);
  });

  it('should return 400 for a page above 500', async () => {
    const { statusCode } = await search({ query: 'cidade', page: 501 });

    expect(statusCode).toBe(400);
    expect(fakeMovieCatalogProvider.searchMovies).not.toHaveBeenCalled();
  });
});

describe('When TMDB is unavailable', () => {
  it('should return 503 MOVIE_CATALOG_UNAVAILABLE', async () => {
    fakeMovieCatalogProvider.searchMovies.mockRejectedValue(
      new ServiceUnavailableError(
        'Movie catalog unavailable',
        'MOVIE_CATALOG_UNAVAILABLE',
      ),
    );

    const { body, statusCode } = await search({ query: 'cidade' });

    expect(statusCode).toBe(503);
    expect(body).toEqual({
      message: 'Movie catalog unavailable',
      status: 503,
      code: 'MOVIE_CATALOG_UNAVAILABLE',
    });
  });
});

describe('When we search without a token', () => {
  it('should return 401', async () => {
    const { statusCode } = await supertest(movieSearchApp.app)
      .get('/tmdb/search')
      .query({ query: 'cidade' });

    expect(statusCode).toBe(401);
  });
});
