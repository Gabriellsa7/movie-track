import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { MmovieEntry } from '../../infrastructure/db/mongo/models/movie-entry.model';
import { toObjectId } from '../../infrastructure/db/mongo/object-id';
import {
  createMovieFor,
  fakeStorageProvider,
  movieEntryApp,
} from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const deleteMovie = (id: string, userId: string) =>
  supertest(movieEntryApp.app)
    .delete(`/movies/${id}`)
    .set('Authorization', authHeaderFor(userId));

beforeEach(() => {
  fakeStorageProvider.delete.mockClear();
});

describe('When we delete one of our movies', () => {
  it('should return 204 and remove it from the database', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await deleteMovie(movie.id, userId);

    expect(statusCode).toBe(204);
    expect(body).toEqual({});
    await expect(MmovieEntry.findById(movie.id)).resolves.toBeNull();
    expect(fakeStorageProvider.delete).not.toHaveBeenCalled();
  });

  it('should also delete its uploaded poster', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);
    await MmovieEntry.updateOne(
      { _id: toObjectId(movie.id) },
      {
        posterUrl: 'https://cdn.example.com/p.png',
        posterPublicId: 'posters/p',
      },
    );

    await deleteMovie(movie.id, userId);

    expect(fakeStorageProvider.delete).toHaveBeenCalledWith('posters/p');
  });
});

describe('When we delete a movie that is not ours', () => {
  it('should return 404 MOVIE_NOT_FOUND and keep it', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await deleteMovie(movie.id, newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
    await expect(MmovieEntry.findById(movie.id)).resolves.not.toBeNull();
  });
});
