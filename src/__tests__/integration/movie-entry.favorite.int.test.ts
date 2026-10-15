import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { createMovieFor, movieEntryApp } from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const patchFavorite = (id: string, body: object, userId: string) =>
  supertest(movieEntryApp.app)
    .patch(`/movies/${id}/favorite`)
    .set('Authorization', authHeaderFor(userId))
    .send(body);

describe('When we mark one of our movies as favorite', () => {
  it('should return 200 and toggle the flag both ways', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const marked = await patchFavorite(movie.id, { isFavorite: true }, userId);
    const unmarked = await patchFavorite(movie.id, { isFavorite: false }, userId);

    expect(marked.statusCode).toBe(200);
    expect(marked.body.isFavorite).toBe(true);
    expect(unmarked.body.isFavorite).toBe(false);
  });
});

describe('When we mark a movie that is not ours as favorite', () => {
  it('should return 404 MOVIE_NOT_FOUND', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await patchFavorite(
      movie.id,
      { isFavorite: true },
      newObjectId(),
    );

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
  });
});

describe('When we mark a movie as favorite without the flag', () => {
  it('should return 400', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { statusCode } = await patchFavorite(movie.id, {}, userId);

    expect(statusCode).toBe(400);
  });
});
