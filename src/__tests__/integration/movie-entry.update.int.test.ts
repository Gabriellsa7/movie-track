import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { MmovieEntry } from '../../infrastructure/db/mongo/models/movie-entry.model';
import {
  createMovieFor,
  fakeStorageProvider,
  KNOWN_GENRES,
  movieEntryApp,
} from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const UPDATE = {
  title: 'Tropa de Elite',
  synopsis: 'A BOPE captain looks for a replacement.',
  releaseYear: 2007,
  genreIds: [KNOWN_GENRES[0]._id],
  rating: 8,
};

let userId: string;

beforeEach(() => {
  userId = newObjectId();
  fakeStorageProvider.delete.mockClear();
});

const putMovie = (id: string, body: object, asUserId = userId) =>
  supertest(movieEntryApp.app)
    .put(`/movies/${id}`)
    .set('Authorization', authHeaderFor(asUserId))
    .send(body);

describe('When we update one of our movies', () => {
  it('should return 200 with the new data and a new updatedAt', async () => {
    const movie = await createMovieFor(userId, { review: 'Good' });

    const { body, statusCode } = await putMovie(movie.id, {
      ...UPDATE,
      review: '',
    });

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({ id: movie.id, title: 'Tropa de Elite', rating: 8 });
    expect(body).not.toHaveProperty('review');
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(movie.updatedAt as string).getTime(),
    );
    const inDb = await MmovieEntry.findById(movie.id).lean();
    expect(inDb).toMatchObject({ normalizedTitle: 'tropa de elite' });
    expect(inDb).not.toHaveProperty('review');
  });

  it('should keep its own title and year without a duplicate error', async () => {
    const movie = await createMovieFor(userId, UPDATE);

    const { statusCode } = await putMovie(movie.id, { ...UPDATE, rating: 10 });

    expect(statusCode).toBe(200);
  });

  it('should return 409 when it becomes another movie of the list', async () => {
    await createMovieFor(userId, UPDATE);
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await putMovie(movie.id, UPDATE);

    expect(statusCode).toBe(409);
    expect(body.code).toBe('MOVIE_ALREADY_LOGGED');
  });
});

describe('When we update the poster through the movie body', () => {
  it('should set an external poster and remove it with null', async () => {
    const movie = await createMovieFor(userId);

    const withPoster = await putMovie(movie.id, {
      ...UPDATE,
      posterUrl: 'https://img.example.com/tropa.jpg',
    });
    const withoutPoster = await putMovie(movie.id, {
      ...UPDATE,
      posterUrl: null,
    });

    expect(withPoster.body.posterUrl).toBe('https://img.example.com/tropa.jpg');
    expect(withoutPoster.statusCode).toBe(200);
    expect(withoutPoster.body).not.toHaveProperty('posterUrl');
    expect(fakeStorageProvider.delete).not.toHaveBeenCalled();
  });
});

describe('When we update a movie that is not ours', () => {
  it('should return 404 MOVIE_NOT_FOUND and keep it unchanged', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await putMovie(movie.id, UPDATE);

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
    await expect(
      MmovieEntry.findById(movie.id).lean(),
    ).resolves.toMatchObject({ title: movie.title });
  });
});

describe('When we update a movie breaking a rule', () => {
  it('should return 422 INVALID_RATING', async () => {
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await putMovie(movie.id, {
      ...UPDATE,
      rating: 11,
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_RATING');
  });

  it('should return 400 when sending watchlistItemId', async () => {
    const movie = await createMovieFor(userId);

    const { statusCode } = await putMovie(movie.id, {
      ...UPDATE,
      watchlistItemId: newObjectId(),
    });

    expect(statusCode).toBe(400);
  });
});
