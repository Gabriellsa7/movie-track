import mongoose from 'mongoose';
import '../../../jest/setup-integration-tests';
import { IWatchlistItemData } from '../../domain/watchlist/interfaces/watchlist.interface';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { WatchlistRepositoryRead } from '../../infrastructure/repository/watchlist/watchlist.repository.read';
import { WatchlistRepositoryWrite } from '../../infrastructure/repository/watchlist/watchlist.repository.write';
import { newObjectId } from '../testUtils';

const watchlistRepositoryRead = new WatchlistRepositoryRead();
const watchlistRepositoryWrite = new WatchlistRepositoryWrite();

const buildItem = (
  userId: string,
  overrides: Partial<IWatchlistItemData> = {},
): IWatchlistItemData => ({
  userId,
  title: 'Dune',
  normalizedTitle: 'dune',
  releaseYear: 2021,
  addedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('When we create a watchlist item', () => {
  it('should return it with string ids and find it only for its owner', async () => {
    const userId = newObjectId();

    const created = await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId),
    );
    const inDb = await Mwatchlist.findById(created._id).lean();

    expect(created._id).toMatch(/^[0-9a-f]{24}$/);
    expect(created.userId).toBe(userId);
    expect(inDb?.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    await expect(
      watchlistRepositoryRead.findWatchlistItemById(created._id, userId),
    ).resolves.toEqual(created);
    await expect(
      watchlistRepositoryRead.findWatchlistItemById(created._id, newObjectId()),
    ).resolves.toBeNull();
  });
});

describe('When we look for a duplicate watchlist item', () => {
  it('should match by title and year, by tmdb id, or by title when both have no year', async () => {
    const userId = newObjectId();
    const withYear = await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId, { tmdbId: 438631 }),
    );
    const withoutYear = await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId, {
        title: 'Akira',
        normalizedTitle: 'akira',
        releaseYear: undefined,
      }),
    );

    const findDuplicate = (params: object) =>
      watchlistRepositoryRead.findDuplicateWatchlistItem({
        userId,
        normalizedTitle: 'none',
        ...params,
      });

    await expect(
      findDuplicate({ normalizedTitle: 'dune', releaseYear: 2021 }),
    ).resolves.toMatchObject({ _id: withYear._id });
    await expect(findDuplicate({ tmdbId: 438631 })).resolves.toMatchObject({
      _id: withYear._id,
    });
    await expect(
      findDuplicate({ normalizedTitle: 'akira' }),
    ).resolves.toMatchObject({ _id: withoutYear._id });
    await expect(
      findDuplicate({ normalizedTitle: 'dune', releaseYear: 1984 }),
    ).resolves.toBeNull();
  });
});

describe('When we list watchlist items', () => {
  it('should return the newest first, filter by search and paginate', async () => {
    const userId = newObjectId();
    await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId, { title: 'Old', normalizedTitle: 'old' }),
    );
    await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId, {
        title: 'Ação',
        normalizedTitle: 'acao',
        addedAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
    );

    const page = await watchlistRepositoryRead.listWatchlistItems(
      userId,
      undefined,
      { limit: 1, offset: 0 },
    );
    const searched = await watchlistRepositoryRead.listWatchlistItems(
      userId,
      'AÇÃ',
      { limit: 10, offset: 0 },
    );

    expect(page.map((item) => item.title)).toEqual(['Ação']);
    expect(searched.map((item) => item.title)).toEqual(['Ação']);
    await expect(
      watchlistRepositoryRead.countWatchlistItems(userId, undefined),
    ).resolves.toBe(2);
    await expect(
      watchlistRepositoryRead.countWatchlistItems(userId, '.*'),
    ).resolves.toBe(0);
  });
});

describe('When we delete watchlist items', () => {
  it('should delete one item only for its owner, then every item of the user', async () => {
    const userId = newObjectId();
    const created = await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId),
    );
    await watchlistRepositoryWrite.createWatchlistItem(
      buildItem(userId, { title: 'Other', normalizedTitle: 'other' }),
    );

    await expect(
      watchlistRepositoryWrite.deleteWatchlistItemById(
        created._id,
        newObjectId(),
      ),
    ).resolves.toBeNull();
    await expect(
      watchlistRepositoryWrite.deleteWatchlistItemById(created._id, userId),
    ).resolves.toEqual(created);

    await watchlistRepositoryWrite.deleteWatchlistItemsByUserId(userId);
    await expect(
      watchlistRepositoryRead.countWatchlistItems(userId, undefined),
    ).resolves.toBe(0);
  });

  it('should return empty results for ids that are not ObjectIds', async () => {
    await expect(
      watchlistRepositoryRead.findWatchlistItemById('bad', newObjectId()),
    ).resolves.toBeNull();
    await expect(
      watchlistRepositoryRead.listWatchlistItems('bad', undefined, {
        limit: 10,
        offset: 0,
      }),
    ).resolves.toEqual([]);
    await expect(
      watchlistRepositoryWrite.deleteWatchlistItemById(newObjectId(), 'bad'),
    ).resolves.toBeNull();
  });
});
