import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { Mgenre } from '../../infrastructure/db/mongo/models/genre.model';
import { toObjectId } from '../../infrastructure/db/mongo/object-id';
import {
  createMovieFor,
  KNOWN_GENRES,
  movieEntryApp,
} from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const getStats = (userId: string, tokenUserId = userId) =>
  supertest(movieEntryApp.app)
    .get(`/users/${userId}/stats`)
    .set('Authorization', authHeaderFor(tokenUserId));

describe('When we get our own stats', () => {
  it('should return 200 with the totals, distribution and months', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, {
      rating: 8,
      durationMinutes: 120,
      isFavorite: true,
    });
    await createMovieFor(userId, { rating: 8 });
    await createMovieFor(userId, { rating: 6.5, durationMinutes: 90 });
    await createMovieFor(newObjectId(), { rating: 1 });

    const { body, statusCode } = await getStats(userId);

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      totalMovies: 3,
      averageRating: 7.5,
      favoritesCount: 1,
      totalWatches: 3,
      totalMinutes: 210,
      ratingDistribution: [
        { rating: 6.5, count: 1 },
        { rating: 8, count: 2 },
      ],
      moviesPerMonth: [
        { month: new Date().toISOString().slice(0, 7), count: 3 },
      ],
    });
    expect(body.topGenres).toEqual(expect.any(Array));
  });

  it('should return empty stats when we have no movies', async () => {
    const userId = newObjectId();

    const { body, statusCode } = await getStats(userId);

    expect(statusCode).toBe(200);
    expect(body).toEqual({
      totalMovies: 0,
      averageRating: null,
      favoritesCount: 0,
      totalWatches: 0,
      totalMinutes: 0,
      ratingDistribution: [],
      moviesPerMonth: [],
      topGenres: [],
    });
  });
});

describe('When we get our stats in Portuguese', () => {
  it('should name the top genres in Portuguese and fall back to English', async () => {
    const [translated, untranslated] = KNOWN_GENRES;
    await Mgenre.updateOne(
      { _id: toObjectId(translated._id) },
      {
        name: 'Stats comedy',
        tmdbGenreId: 990_035,
        translatedNames: { 'pt-BR': 'Comédia das estatísticas' },
      },
      { upsert: true },
    );
    await Mgenre.updateOne(
      { _id: toObjectId(untranslated._id) },
      { name: 'Stats drama', tmdbGenreId: 990_018 },
      { upsert: true },
    );
    const userId = newObjectId();
    await createMovieFor(userId, { genreIds: [translated._id] });
    await createMovieFor(userId, { genreIds: [translated._id] });
    await createMovieFor(userId, { genreIds: [untranslated._id] });

    const { body, statusCode } = await getStats(userId).set(
      'Accept-Language',
      'pt-BR',
    );

    expect(statusCode).toBe(200);
    expect(body.topGenres).toEqual([
      {
        genreId: translated._id,
        name: 'Comédia das estatísticas',
        count: 2,
      },
      { genreId: untranslated._id, name: 'Stats drama', count: 1 },
    ]);
  });
});

describe("When we get another user's stats", () => {
  it('should return 403 FORBIDDEN_RESOURCE', async () => {
    const { body, statusCode } = await getStats(newObjectId(), newObjectId());

    expect(statusCode).toBe(403);
    expect(body.code).toBe('FORBIDDEN_RESOURCE');
  });
});

describe('When we get stats without a token', () => {
  it('should return 401', async () => {
    const { statusCode } = await supertest(movieEntryApp.app).get(
      `/users/${newObjectId()}/stats`,
    );

    expect(statusCode).toBe(401);
  });
});
