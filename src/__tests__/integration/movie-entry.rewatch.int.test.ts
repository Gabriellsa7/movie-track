import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { MmovieEntry } from '../../infrastructure/db/mongo/models/movie-entry.model';
import { toObjectId } from '../../infrastructure/db/mongo/object-id';
import { createMovieFor, movieEntryApp } from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const rewatch = (id: string, userId: string, body?: object) => {
  const request = supertest(movieEntryApp.app)
    .post(`/movies/${id}/rewatch`)
    .set('Authorization', authHeaderFor(userId));
  return body ? request.send(body) : request;
};

const today = () => new Date().toISOString().slice(0, 10);

describe('When we log a movie', () => {
  it('should count it as watched once unless we say otherwise', async () => {
    const userId = newObjectId();

    const once = await createMovieFor(userId);
    const thrice = await createMovieFor(userId, { watchCount: 3 });

    expect(once.watchCount).toBe(1);
    expect(thrice.watchCount).toBe(3);
  });
});

describe('When we watch one of our movies again', () => {
  it('should return 200 with one more watch and today as the last watch', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId, { watchedAt: '2026-01-10' });

    const { body, statusCode } = await rewatch(movie.id, userId);

    expect(statusCode).toBe(200);
    expect(body.watchCount).toBe(2);
    expect(body.watchedAt.slice(0, 10)).toBe(today());
  });

  it('should keep the latest watch date for an older rewatch', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId, { watchedAt: '2026-03-01' });

    const { body } = await rewatch(movie.id, userId, {
      watchedAt: '2026-01-15',
    });

    expect(body.watchCount).toBe(2);
    expect(body.watchedAt.slice(0, 10)).toBe('2026-03-01');
  });

  it('should return 422 INVALID_WATCHED_AT for a date in the future', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await rewatch(movie.id, userId, {
      watchedAt: '2999-01-01',
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_WATCHED_AT');
  });

  it('should return 404 for a movie that is not ours', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await rewatch(movie.id, newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
  });
});

describe('When a movie was logged before the counter existed', () => {
  it('should read as watched once and count up from there', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);
    await MmovieEntry.updateOne(
      { _id: toObjectId(movie.id) },
      { $unset: { watchCount: '' } },
    );

    const { body } = await rewatch(movie.id, userId);

    expect(body.watchCount).toBe(2);
  });
});

describe('When we sort our movies by how many times we watched them', () => {
  it('should list the most rewatched first', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { title: 'Once', watchCount: 1 });
    await createMovieFor(userId, { title: 'Five times', watchCount: 5 });
    await createMovieFor(userId, { title: 'Twice', watchCount: 2 });

    const { body } = await supertest(movieEntryApp.app)
      .get('/movies')
      .query({ sort: 'watchCount', order: 'desc' })
      .set('Authorization', authHeaderFor(userId));

    expect(body.items.map((movie: { title: string }) => movie.title)).toEqual([
      'Five times',
      'Twice',
      'Once',
    ]);
  });
});

describe('When we get our stats with rewatched movies', () => {
  it('should count every watch and multiply the minutes', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { durationMinutes: 100, watchCount: 3 });
    await createMovieFor(userId, { durationMinutes: 90 });

    const { body } = await supertest(movieEntryApp.app)
      .get(`/users/${userId}/stats`)
      .set('Authorization', authHeaderFor(userId));

    expect(body).toMatchObject({
      totalMovies: 2,
      totalWatches: 4,
      totalMinutes: 390,
    });
  });
});
