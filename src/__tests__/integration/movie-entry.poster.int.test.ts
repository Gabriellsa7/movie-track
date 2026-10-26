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

const uploadPoster = (id: string, userId: string) =>
  supertest(movieEntryApp.app)
    .put(`/movies/${id}/poster`)
    .set('Authorization', authHeaderFor(userId));

const A_PNG = Buffer.from('fake png bytes');
const SIX_MEGABYTES = Buffer.alloc(6 * 1024 * 1024);

beforeEach(() => {
  fakeStorageProvider.delete.mockClear();
  fakeStorageProvider.upload.mockReset();
  fakeStorageProvider.upload.mockResolvedValue({
    url: 'https://cdn.example.com/posters/new.png',
    publicId: 'posters/new.png',
  });
});

describe('When we upload a poster to one of our movies', () => {
  it('should return 200 with the new poster url and store the file', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await uploadPoster(movie.id, userId).attach(
      'poster',
      A_PNG,
      { filename: 'poster.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(200);
    expect(body.posterUrl).toBe('https://cdn.example.com/posters/new.png');
    expect(fakeStorageProvider.upload).toHaveBeenCalledWith({
      buffer: A_PNG,
      mimeType: 'image/png',
      folder: 'posters',
    });
    const inDb = await MmovieEntry.findById(movie.id).lean();
    expect(inDb?.posterPublicId).toBe('posters/new.png');
  });

  it('should delete the previously uploaded poster', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);
    await MmovieEntry.updateOne(
      { _id: toObjectId(movie.id) },
      {
        posterUrl: 'https://cdn.example.com/posters/old.png',
        posterPublicId: 'posters/old.png',
      },
    );

    const { statusCode } = await uploadPoster(movie.id, userId).attach(
      'poster',
      A_PNG,
      { filename: 'poster.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(200);
    expect(fakeStorageProvider.delete).toHaveBeenCalledWith('posters/old.png');
  });
});

describe('When we upload a poster that is not a JPEG, PNG or WebP image', () => {
  it('should return 422 INVALID_POSTER_TYPE without storing it', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await uploadPoster(movie.id, userId).attach(
      'poster',
      Buffer.from('GIF89a'),
      { filename: 'poster.gif', contentType: 'image/gif' },
    );

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_POSTER_TYPE');
    expect(fakeStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we upload a poster bigger than 5 MB', () => {
  it('should return 413 PAYLOAD_TOO_LARGE', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await uploadPoster(movie.id, userId).attach(
      'poster',
      SIX_MEGABYTES,
      { filename: 'poster.png', contentType: 'image/png' },
    );

    expect(statusCode).toBe(413);
    expect(body.code).toBe('PAYLOAD_TOO_LARGE');
    expect(fakeStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we send the poster as a text field instead of a file', () => {
  it('should return 400 VALIDATION_ERROR', async () => {
    const userId = newObjectId();
    const movie = await createMovieFor(userId);

    const { body, statusCode } = await uploadPoster(movie.id, userId).field(
      'poster',
      'not a file',
    );

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(fakeStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we upload a poster to a movie that is not ours', () => {
  it('should return 404 MOVIE_NOT_FOUND without storing it', async () => {
    const movie = await createMovieFor(newObjectId());

    const { body, statusCode } = await uploadPoster(
      movie.id,
      newObjectId(),
    ).attach('poster', A_PNG, {
      filename: 'poster.png',
      contentType: 'image/png',
    });

    expect(statusCode).toBe(404);
    expect(body.code).toBe('MOVIE_NOT_FOUND');
    expect(fakeStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we upload a poster without a token', () => {
  it('should return 401', async () => {
    const movie = await createMovieFor(newObjectId());

    const { statusCode } = await supertest(movieEntryApp.app)
      .put(`/movies/${movie.id}/poster`)
      .attach('poster', A_PNG, {
        filename: 'poster.png',
        contentType: 'image/png',
      });

    expect(statusCode).toBe(401);
  });
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
