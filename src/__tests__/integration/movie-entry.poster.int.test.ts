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

const removePoster = (id: string, userId: string) =>
  supertest(movieEntryApp.app)
    .delete(`/movies/${id}/poster`)
    .set('Authorization', authHeaderFor(userId));

beforeEach(() => {
  fakeStorageProvider.delete.mockClear();
});

describe('When we remove the uploaded poster of one of our movies', () => {
  it('should return 200 without the poster and delete the file', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);
    await MmovieEntry.updateOne(
      { _id: toObjectId(movie.id) },
      {
        posterUrl: 'https://cdn.example.com/p.png',
        posterPublicId: 'posters/p',
      },
    );

    const { body, statusCode } = await removePoster(movie.id, userId);

    expect(statusCode).toBe(200);
    expect(body).not.toHaveProperty('posterUrl');
    expect(fakeStorageProvider.delete).toHaveBeenCalledWith('posters/p');
    const inDb = await MmovieEntry.findById(movie.id).lean();
    expect(inDb).not.toHaveProperty('posterPublicId');
  });
});

describe('When we remove a poster from a movie without one', () => {
  it('should return 200 and change nothing', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await removePoster(movie.id, userId);

    expect(statusCode).toBe(200);
    expect(body).toEqual(movie);
    expect(fakeStorageProvider.delete).not.toHaveBeenCalled();
  });
});

describe('When we remove the poster of a movie that is not ours', () => {
  it('should return 404 MOVIE_NOT_FOUND', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await removePoster(movie.id, newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
  });
});
