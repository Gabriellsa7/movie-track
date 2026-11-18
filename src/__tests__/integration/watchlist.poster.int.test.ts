import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { WatchlistRepositoryWrite } from '../../infrastructure/repository/watchlist/watchlist.repository.write';
import {
  fakeWatchlistStorageProvider,
  watchlistApp,
} from '../configWatchlistApp';
import { authHeaderFor, ensureUserExists, newObjectId } from '../testUtils';

const watchlistRepositoryWrite = new WatchlistRepositoryWrite();

async function addItemFor(userId: string, fields: object = {}) {
  await ensureUserExists(userId);
  return watchlistRepositoryWrite.createWatchlistItem({
    userId,
    title: 'Past Lives',
    normalizedTitle: 'past lives',
    addedAt: new Date(),
    ...fields,
  });
}

const uploadPoster = (id: string, userId: string) =>
  supertest(watchlistApp.app)
    .put(`/watchlist/${id}/poster`)
    .set('Authorization', authHeaderFor(userId));

const removePoster = (id: string, userId: string) =>
  supertest(watchlistApp.app)
    .delete(`/watchlist/${id}/poster`)
    .set('Authorization', authHeaderFor(userId));

const A_PNG = Buffer.from('fake png bytes');
const PNG_FILE = { filename: 'poster.png', contentType: 'image/png' };

beforeEach(() => {
  fakeWatchlistStorageProvider.delete.mockClear();
  fakeWatchlistStorageProvider.upload.mockReset();
  fakeWatchlistStorageProvider.upload.mockResolvedValue({
    url: 'https://cdn.example.com/posters/new.png',
    publicId: 'posters/new.png',
  });
});

describe('When we upload a poster to one of our watchlist items', () => {
  it('should return 200 with the new poster url and store the file', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId);

    const { body, statusCode } = await uploadPoster(item._id, userId).attach(
      'poster',
      A_PNG,
      PNG_FILE,
    );

    expect(statusCode).toBe(200);
    expect(body.posterUrl).toBe('https://cdn.example.com/posters/new.png');
    expect(body).not.toHaveProperty('posterPublicId');
    expect(fakeWatchlistStorageProvider.upload).toHaveBeenCalledWith({
      buffer: A_PNG,
      mimeType: 'image/png',
      folder: 'posters',
    });
    const inDb = await Mwatchlist.findById(item._id).lean();
    expect(inDb?.posterPublicId).toBe('posters/new.png');
  });

  it('should delete the previously uploaded poster', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId, {
      posterUrl: 'https://cdn.example.com/posters/old.png',
      posterPublicId: 'posters/old.png',
    });

    const { statusCode } = await uploadPoster(item._id, userId).attach(
      'poster',
      A_PNG,
      PNG_FILE,
    );

    expect(statusCode).toBe(200);
    expect(fakeWatchlistStorageProvider.delete).toHaveBeenCalledWith(
      'posters/old.png',
    );
  });
});

describe('When we upload a watchlist poster that is not a JPEG, PNG or WebP image', () => {
  it('should return 422 INVALID_POSTER_TYPE without storing it', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId);

    const { body, statusCode } = await uploadPoster(item._id, userId).attach(
      'poster',
      Buffer.from('GIF89a'),
      { filename: 'poster.gif', contentType: 'image/gif' },
    );

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_POSTER_TYPE');
    expect(fakeWatchlistStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we upload a poster to a watchlist item that is not ours', () => {
  it('should return 404 WATCHLIST_ITEM_NOT_FOUND without storing it', async () => {
    const item = await addItemFor(newObjectId());

    const { body, statusCode } = await uploadPoster(
      item._id,
      newObjectId(),
    ).attach('poster', A_PNG, PNG_FILE);

    expect(statusCode).toBe(404);
    expect(body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
    expect(fakeWatchlistStorageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we upload a watchlist poster without a token', () => {
  it('should return 401', async () => {
    const item = await addItemFor(newObjectId());

    const { statusCode } = await supertest(watchlistApp.app)
      .put(`/watchlist/${item._id}/poster`)
      .attach('poster', A_PNG, PNG_FILE);

    expect(statusCode).toBe(401);
  });
});

describe('When we remove the uploaded poster of a watchlist item', () => {
  it('should return 200 without the poster and delete the file', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId, {
      posterUrl: 'https://cdn.example.com/p.png',
      posterPublicId: 'posters/p',
    });

    const { body, statusCode } = await removePoster(item._id, userId);

    expect(statusCode).toBe(200);
    expect(body).not.toHaveProperty('posterUrl');
    expect(fakeWatchlistStorageProvider.delete).toHaveBeenCalledWith(
      'posters/p',
    );
    const inDb = await Mwatchlist.findById(item._id).lean();
    expect(inDb).not.toHaveProperty('posterPublicId');
  });

  it('should return 404 WATCHLIST_ITEM_NOT_FOUND for an item that is not ours', async () => {
    const item = await addItemFor(newObjectId());

    const { body, statusCode } = await removePoster(item._id, newObjectId());

    expect(statusCode).toBe(404);
    expect(body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
  });
});

describe('When we delete a watchlist item with an uploaded poster', () => {
  it('should delete the file too', async () => {
    const userId = newObjectId();
    const item = await addItemFor(userId, {
      posterUrl: 'https://cdn.example.com/p.png',
      posterPublicId: 'posters/p',
    });

    const { statusCode } = await supertest(watchlistApp.app)
      .delete(`/watchlist/${item._id}`)
      .set('Authorization', authHeaderFor(userId));

    expect(statusCode).toBe(204);
    expect(fakeWatchlistStorageProvider.delete).toHaveBeenCalledWith(
      'posters/p',
    );
  });
});
