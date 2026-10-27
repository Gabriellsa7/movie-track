import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { WatchlistRepositoryWrite } from '../../infrastructure/repository/watchlist/watchlist.repository.write';
import { KNOWN_GENRES, movieEntryApp } from '../configMovieEntryApp';
import { authHeaderFor, ensureUserExists, newObjectId } from '../testUtils';

const watchlistRepositoryWrite = new WatchlistRepositoryWrite();

async function addItemFor(userId: string, fields: object = {}) {
  await ensureUserExists(userId);
  return watchlistRepositoryWrite.createWatchlistItem({
    userId,
    title: 'Interestelar',
    normalizedTitle: 'interestelar',
    addedAt: new Date(),
    ...fields,
  });
}

const markWatched = (userId: string, itemId: string, body: object) =>
  supertest(movieEntryApp.app)
    .post(`/watchlist/${itemId}/watched`)
    .set('Authorization', authHeaderFor(userId))
    .send(body);

describe('When we mark a complete watchlist item as watched', () => {
  it('should return 201 with the movie built from the item and remove the item', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId, {
      tmdbId: 157336,
      posterUrl: 'https://cdn.example.com/interstellar.png',
      releaseYear: 2014,
      synopsis: 'Explorers travel through a wormhole.',
      genreIds: [KNOWN_GENRES[0]._id],
      director: 'Christopher Nolan',
      durationMinutes: 169,
      plannedFor: new Date(),
    });

    const { body, statusCode } = await markWatched(userId, item._id, {
      rating: 10,
      review: 'Masterpiece',
      isFavorite: true,
    });

    expect(statusCode).toBe(201);
    expect(body).toMatchObject({
      userId,
      title: 'Interestelar',
      tmdbId: 157336,
      posterUrl: 'https://cdn.example.com/interstellar.png',
      releaseYear: 2014,
      synopsis: 'Explorers travel through a wormhole.',
      genreIds: [KNOWN_GENRES[0]._id],
      director: 'Christopher Nolan',
      durationMinutes: 169,
      rating: 10,
      review: 'Masterpiece',
      isFavorite: true,
      watchCount: 1,
    });
    await expect(Mwatchlist.findById(item._id)).resolves.toBeNull();
  });
});

describe('When the watchlist item lacks movie data', () => {
  it('should return 422 INCOMPLETE_MOVIE naming the missing fields and keep the item', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId);

    const { body, statusCode } = await markWatched(userId, item._id, {
      rating: 8,
    });

    expect(statusCode).toBe(422);
    expect(body).toMatchObject({
      code: 'INCOMPLETE_MOVIE',
      message:
        'Send synopsis, releaseYear, genreIds: the watchlist item does not have them',
    });
    await expect(Mwatchlist.findById(item._id)).resolves.not.toBeNull();
  });

  it('should accept the missing fields in the request', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId);

    const { body, statusCode } = await markWatched(userId, item._id, {
      rating: 8,
      synopsis: 'Explorers travel through a wormhole.',
      releaseYear: 2014,
      genreIds: [KNOWN_GENRES[1]._id],
    });

    expect(statusCode).toBe(201);
    expect(body.genreIds).toEqual([KNOWN_GENRES[1]._id]);
  });
});

describe('When marking as watched breaks a movie rule', () => {
  it('should return 422 INVALID_RATING and keep the item', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId, {
      releaseYear: 2014,
      synopsis: 'Explorers.',
      genreIds: [KNOWN_GENRES[0]._id],
    });

    const { body, statusCode } = await markWatched(userId, item._id, {
      rating: 7.3,
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_RATING');
    await expect(Mwatchlist.findById(item._id)).resolves.not.toBeNull();
  });

  it('should return 404 for an item that is not ours', async () => {
    const item = await addItemFor(newObjectId());

    const { body, statusCode } = await markWatched(newObjectId(), item._id, {
      rating: 8,
    });

    expect(statusCode).toBe(404);
    expect(body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
  });

  it('should return 400 without a rating', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId);

    const { statusCode } = await markWatched(userId, item._id, {});

    expect(statusCode).toBe(400);
  });
});
