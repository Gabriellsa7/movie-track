import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { createMovieFor, movieEntryApp } from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

describe('When we get one of our movies', () => {
  it('should return 200 with the movie', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId, { review: 'Loved it' });

    const { body, statusCode } = await supertest(movieEntryApp.app)
      .get(`/movies/${movie.id}`)
      .set('Authorization', authHeaderFor(userId));

    expect(statusCode).toBe(200);
    expect(body).toEqual(movie);
  });
});

describe('When we get a movie that is not ours or does not exist', () => {
  it.each([
    ['of another user', true],
    ['that does not exist', false],
  ])('should return 404 MOVIE_NOT_FOUND for a movie %s', async (_case, exists) => {
    const movieId = exists
      ? (await createMovieFor(newObjectId())).id
      : newObjectId();

    const { body, statusCode } = await supertest(movieEntryApp.app)
      .get(`/movies/${movieId}`)
      .set('Authorization', authHeaderFor(newObjectId()));

    expect(statusCode).toBe(404);
    expect(body).toEqual({
      message: 'Movie not found',
      status: 404,
      code: 'MOVIE_NOT_FOUND',
    });
  });

  it('should return 400 when the id is not an ObjectId', async () => {
    const { statusCode } = await supertest(movieEntryApp.app)
      .get('/movies/not-an-object-id')
      .set('Authorization', authHeaderFor(newObjectId()));

    expect(statusCode).toBe(400);
  });
});
