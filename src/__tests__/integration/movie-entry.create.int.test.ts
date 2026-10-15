import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { WatchlistRepositoryWrite } from '../../infrastructure/repository/watchlist/watchlist.repository.write';
import { KNOWN_GENRES, movieEntryApp } from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const NEW_MOVIE = {
  title: '  Cidade de Deus ',
  synopsis: 'Two boys grow up in a Rio favela.',
  releaseYear: 2002,
  genreIds: [KNOWN_GENRES[0]._id],
  rating: 9.5,
};

let userId: string;

beforeEach(() => {
  userId = newObjectId();
});

const postMovie = (body: object, asUserId = userId) =>
  supertest(movieEntryApp.app)
    .post('/movies')
    .set('Authorization', authHeaderFor(asUserId))
    .send(body);

describe('When we log a movie with valid data', () => {
  it('should return 201 with the movie owned by the token user', async () => {
    const { body, statusCode } = await postMovie(NEW_MOVIE);

    expect(statusCode).toBe(201);
    expect(body).toMatchObject({
      userId,
      title: 'Cidade de Deus',
      rating: 9.5,
      isFavorite: false,
      genreIds: NEW_MOVIE.genreIds,
    });
    expect(body.id).toMatch(/^[0-9a-f]{24}$/);
    expect(body).not.toHaveProperty('_id');
    expect(body).not.toHaveProperty('normalizedTitle');
    expect(new Date(body.watchedAt).getTime()).not.toBeNaN();
  });

  it('should accept the date it was watched', async () => {
    const { body, statusCode } = await postMovie({
      ...NEW_MOVIE,
      watchedAt: '2026-01-02',
    });

    expect(statusCode).toBe(201);
    expect(body.watchedAt).toBe('2026-01-02T00:00:00.000Z');
  });
});

describe('When we log a movie that is already in the list', () => {
  it('should return 409 MOVIE_ALREADY_LOGGED for the same title and year', async () => {
    await postMovie(NEW_MOVIE);

    const { body, statusCode } = await postMovie({
      ...NEW_MOVIE,
      title: 'CIDADE DE DEUS',
    });

    expect(statusCode).toBe(409);
    expect(body.code).toBe('MOVIE_ALREADY_LOGGED');
  });

  it('should allow another user to log the same movie', async () => {
    await postMovie(NEW_MOVIE);

    const { statusCode } = await postMovie(NEW_MOVIE, newObjectId());

    expect(statusCode).toBe(201);
  });
});

describe('When we log a movie breaking a business rule', () => {
  it.each([
    ['a rating out of the 0.5 steps', { rating: 7.3 }, 'INVALID_RATING'],
    ['an unknown genre', { genreIds: [newObjectId()] }, 'INVALID_GENRE'],
    ['no genre', { genreIds: [] }, 'INVALID_GENRE'],
    ['a release year after next year', { releaseYear: 2999 }, 'INVALID_RELEASE_YEAR'],
    ['a watch date in the future', { watchedAt: '2999-01-01' }, 'INVALID_WATCHED_AT'],
  ])('should return 422 with %s', async (_case, override, code) => {
    const { body, statusCode } = await postMovie({ ...NEW_MOVIE, ...override });

    expect(statusCode).toBe(422);
    expect(body).toMatchObject({ status: 422, code });
  });
});

describe('When we log a movie with an invalid body', () => {
  it.each([
    ['without a title', { title: undefined }],
    ['with a blank title', { title: '   ' }],
    ['with a release year before cinema', { releaseYear: 1800 }],
    ['with a non-http poster', { posterUrl: 'ftp://poster.png' }],
    ['with a userId in the body', { userId: newObjectId() }],
  ])('should return 400 %s', async (_case, override) => {
    const { body, statusCode } = await postMovie({ ...NEW_MOVIE, ...override });

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });
});

describe('When we log a movie from the watchlist', () => {
  it('should create the movie and remove the watchlist item', async () => {
    const item = await new WatchlistRepositoryWrite().createWatchlistItem({
      userId,
      title: 'Cidade de Deus',
      normalizedTitle: 'cidade de deus',
      addedAt: new Date(),
    });

    const { statusCode } = await postMovie({
      ...NEW_MOVIE,
      watchlistItemId: item._id,
    });

    expect(statusCode).toBe(201);
    await expect(Mwatchlist.findById(item._id)).resolves.toBeNull();
  });

  it("should return 404 WATCHLIST_ITEM_NOT_FOUND for another user's item", async () => {
    const item = await new WatchlistRepositoryWrite().createWatchlistItem({
      userId: newObjectId(),
      title: 'Cidade de Deus',
      normalizedTitle: 'cidade de deus',
      addedAt: new Date(),
    });

    const { body, statusCode } = await postMovie({
      ...NEW_MOVIE,
      watchlistItemId: item._id,
    });

    expect(statusCode).toBe(404);
    expect(body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
  });
});

describe('When we log a movie without a token', () => {
  it('should return 401', async () => {
    const { statusCode } = await supertest(movieEntryApp.app)
      .post('/movies')
      .send(NEW_MOVIE);

    expect(statusCode).toBe(401);
  });
});
