import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import {
  KNOWN_GENRES,
  createMovieFor,
  movieEntryApp,
} from '../configMovieEntryApp';
import { ensureUserExists, newObjectId } from '../testUtils';

const listUserMovies = (userId: string, query: object = {}) =>
  supertest(movieEntryApp.app).get(`/users/${userId}/movies`).query(query);

const getUserMovie = (userId: string, movieId: string) =>
  supertest(movieEntryApp.app).get(`/users/${userId}/movies/${movieId}`);

describe("When anyone lists a user's movies without logging in", () => {
  it('should return 200 with only that user\'s movies, rating and review', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId, {
      rating: 8.5,
      review: 'A classic.',
    });
    await createMovieFor(newObjectId());

    const { body, statusCode } = await listUserMovies(userId);

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ total: 1, page: 1, limit: 20 });
    expect(body.items).toEqual([
      expect.objectContaining({
        id: movie.id,
        userId,
        rating: 8.5,
        review: 'A classic.',
      }),
    ]);
  });

  it('should apply the same filters, sort and pagination as my list', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { rating: 9, isFavorite: true });
    await createMovieFor(userId, { rating: 6, isFavorite: true });
    await createMovieFor(userId, {
      rating: 8,
      genreIds: [KNOWN_GENRES[1]._id],
    });

    const { body, statusCode } = await listUserMovies(userId, {
      favorite: true,
      sort: 'rating',
      order: 'asc',
      limit: 1,
    });

    expect(statusCode).toBe(200);
    expect(body.total).toBe(2);
    expect(body.items.map((item: { rating: number }) => item.rating)).toEqual([
      6,
    ]);
  });

  it('should return an empty page for a user without movies', async () => {
    const userId = newObjectId();
    await ensureUserExists(userId);

    const { body, statusCode } = await listUserMovies(userId);

    expect(statusCode).toBe(200);
    expect(body).toEqual({ items: [], total: 0, page: 1, limit: 20 });
  });

  it('should return 404 USER_NOT_FOUND for an unknown user', async () => {
    const { body, statusCode } = await listUserMovies(newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('USER_NOT_FOUND');
  });

  it('should return 422 INVALID_RATING_RANGE for an inverted rating range', async () => {
    const userId = newObjectId();
    await ensureUserExists(userId);

    const { body, statusCode } = await listUserMovies(userId, {
      minRating: 8,
      maxRating: 4,
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_RATING_RANGE');
  });
});

describe("When anyone opens one of a user's movies without logging in", () => {
  it('should return 200 with the movie and its review', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId, { review: 'Loved it.' });

    const { body, statusCode } = await getUserMovie(userId, movie.id);

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ id: movie.id, userId, review: 'Loved it.' });
  });

  it('should return 404 MOVIE_NOT_FOUND when the movie belongs to someone else', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await getUserMovie(newObjectId(), movie.id);

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
  });

  it('should return 400 for a malformed movie id', async () => {
    const { statusCode } = await getUserMovie(newObjectId(), 'not-an-id');

    expect(statusCode).toBe(400);
  });
});
