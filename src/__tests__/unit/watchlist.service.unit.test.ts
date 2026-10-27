import { IGenreRepositoryRead } from '../../domain/genre/repository/genre.repository.read';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { Logger } from 'traceability';
import { IClock } from '../../domain/common/providers/clock.provider';
import { IMovieEntry } from '../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryRepositoryRead } from '../../domain/movie-entry/repository/movie-entry.repository.read';
import {
  EWatchlistPriority,
  EWatchlistSortField,
  IWatchlistItem,
} from '../../domain/watchlist/interfaces/watchlist.interface';
import { IWatchlistRepositoryRead } from '../../domain/watchlist/repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../../domain/watchlist/repository/watchlist.repository.write';
import { WatchlistService } from '../../domain/watchlist/service/watchlist.service';

const NOW = new Date('2026-02-01T00:00:00.000Z');
const USER_ID = 'user-1';

const AN_ITEM: IWatchlistItem = {
  _id: 'item-1',
  userId: USER_ID,
  title: 'Seven',
  normalizedTitle: 'seven',
  releaseYear: 1995,
  priority: EWatchlistPriority.MEDIUM,
  addedAt: NOW,
};

let genreRepositoryRead: jest.Mocked<IGenreRepositoryRead>;
let userRepositoryRead: jest.Mocked<
  Pick<IUserRepositoryRead, 'findUserById'>
>;
let watchlistRepositoryRead: jest.Mocked<IWatchlistRepositoryRead>;
let watchlistRepositoryWrite: jest.Mocked<IWatchlistRepositoryWrite>;
let movieEntryRepositoryRead: jest.Mocked<
  Pick<IMovieEntryRepositoryRead, 'findDuplicateMovieEntry'>
>;
let watchlistService: WatchlistService;

beforeEach(() => {
  watchlistRepositoryRead = {
    findWatchlistItemById: jest.fn(),
    findDuplicateWatchlistItem: jest.fn().mockResolvedValue(null),
    listWatchlistItems: jest.fn(),
    countWatchlistItems: jest.fn(),
  };
  watchlistRepositoryWrite = {
    createWatchlistItem: jest.fn(async (itemData) => ({
      ...itemData,
      priority: itemData.priority ?? EWatchlistPriority.MEDIUM,
      _id: 'item-1',
    })),
    updateWatchlistItemById: jest.fn(),
    deleteWatchlistItemById: jest.fn(),
    deleteWatchlistItemsByUserId: jest.fn(),
  };
  movieEntryRepositoryRead = {
    findDuplicateMovieEntry: jest.fn().mockResolvedValue(null),
  };
  genreRepositoryRead = {
    listGenres: jest.fn(),
    findGenresByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ _id: id, name: id, tmdbGenreId: 1 })),
    ),
    findGenresByTmdbIds: jest.fn(),
  };
  userRepositoryRead = {
    findUserById: jest.fn().mockResolvedValue({ _id: 'user-1' }),
  };
  const clock: IClock = { now: () => NOW };
  watchlistService = new WatchlistService({
    watchlistRepositoryRead,
    watchlistRepositoryWrite,
    movieEntryRepositoryRead:
      movieEntryRepositoryRead as unknown as IMovieEntryRepositoryRead,
    userRepositoryRead:
      userRepositoryRead as unknown as IUserRepositoryRead,
    genreRepositoryRead,
    clock,
  });
});

describe('When we add a movie to the watchlist', () => {
  it('should save it with a normalized title and the current date', async () => {
    const item = await watchlistService.addWatchlistItem({
      userId: USER_ID,
      title: ' Séven ',
      releaseYear: 1995,
      tmdbId: 807,
    });

    expect(watchlistRepositoryWrite.createWatchlistItem).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        title: 'Séven',
        normalizedTitle: 'seven',
        releaseYear: 1995,
        tmdbId: 807,
        addedAt: NOW,
      }),
    );
    expect(item._id).toBe('item-1');
  });

  it('should look for the same movie by tmdbId, title and year', async () => {
    await watchlistService.addWatchlistItem({
      userId: USER_ID,
      title: 'Seven',
      releaseYear: 1995,
      tmdbId: 807,
    });

    expect(
      watchlistRepositoryRead.findDuplicateWatchlistItem,
    ).toHaveBeenCalledWith({
      userId: USER_ID,
      tmdbId: 807,
      normalizedTitle: 'seven',
      releaseYear: 1995,
    });
  });

  it('should accept a movie released next year', async () => {
    await expect(
      watchlistService.addWatchlistItem({
        userId: USER_ID,
        title: 'Upcoming',
        releaseYear: 2027,
      }),
    ).resolves.toBeDefined();
  });
});

describe('When we add a movie that is already in the watchlist', () => {
  it('should throw 409 ALREADY_IN_WATCHLIST and save nothing', async () => {
    watchlistRepositoryRead.findDuplicateWatchlistItem.mockResolvedValue(
      AN_ITEM,
    );

    await expect(
      watchlistService.addWatchlistItem({ userId: USER_ID, title: 'Seven' }),
    ).rejects.toMatchObject({ status: 409, code: 'ALREADY_IN_WATCHLIST' });
    expect(watchlistRepositoryWrite.createWatchlistItem).not.toHaveBeenCalled();
  });
});

describe('When we add a movie we have already watched', () => {
  it('should throw 409 MOVIE_ALREADY_LOGGED and save nothing', async () => {
    movieEntryRepositoryRead.findDuplicateMovieEntry.mockResolvedValue({
      _id: 'entry-1',
    } as IMovieEntry);

    await expect(
      watchlistService.addWatchlistItem({
        userId: USER_ID,
        title: 'Seven',
        releaseYear: 1995,
        tmdbId: 807,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'MOVIE_ALREADY_LOGGED' });
    expect(
      movieEntryRepositoryRead.findDuplicateMovieEntry,
    ).toHaveBeenCalledWith({
      userId: USER_ID,
      tmdbId: 807,
      normalizedTitle: 'seven',
      releaseYear: 1995,
    });
    expect(watchlistRepositoryWrite.createWatchlistItem).not.toHaveBeenCalled();
  });
});

describe('When the token belongs to a deleted account', () => {
  it('should reject the creation with 401 INVALID_TOKEN and save nothing', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(watchlistService.addWatchlistItem({ userId: USER_ID, title: 'Seven' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
    expect(watchlistRepositoryWrite.createWatchlistItem).not.toHaveBeenCalled();
  });
});

describe('When we add a movie released after next year', () => {
  it('should throw 422 INVALID_RELEASE_YEAR and save nothing', async () => {
    await expect(
      watchlistService.addWatchlistItem({
        userId: USER_ID,
        title: 'Too far',
        releaseYear: 2028,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_RELEASE_YEAR' });
    expect(watchlistRepositoryWrite.createWatchlistItem).not.toHaveBeenCalled();
  });
});

describe('When we list the watchlist', () => {
  it('should return the page of items with the total and page metadata', async () => {
    watchlistRepositoryRead.listWatchlistItems.mockResolvedValue([AN_ITEM]);
    watchlistRepositoryRead.countWatchlistItems.mockResolvedValue(21);

    const filter = {
      userId: USER_ID,
      search: 'sev',
      priority: EWatchlistPriority.HIGH,
    };

    const result = await watchlistService.listWatchlistItems({
      filter,
      sort: EWatchlistSortField.PRIORITY,
      pagination: { limit: 10, offset: 20 },
    });

    expect(result).toEqual({ items: [AN_ITEM], total: 21, page: 3, limit: 10 });
    expect(watchlistRepositoryRead.listWatchlistItems).toHaveBeenCalledWith(
      filter,
      EWatchlistSortField.PRIORITY,
      { limit: 10, offset: 20 },
    );
    expect(watchlistRepositoryRead.countWatchlistItems).toHaveBeenCalledWith(
      filter,
    );
  });
});

describe('When we remove a movie from the watchlist', () => {
  it('should delete the item of that user', async () => {
    watchlistRepositoryWrite.deleteWatchlistItemById.mockResolvedValue(AN_ITEM);

    await watchlistService.removeWatchlistItem('item-1', USER_ID);

    expect(
      watchlistRepositoryWrite.deleteWatchlistItemById,
    ).toHaveBeenCalledWith('item-1', USER_ID);
  });

  it('should throw 404 WATCHLIST_ITEM_NOT_FOUND when it is not there', async () => {
    watchlistRepositoryWrite.deleteWatchlistItemById.mockResolvedValue(null);

    await expect(
      watchlistService.removeWatchlistItem('missing', USER_ID),
    ).rejects.toMatchObject({ status: 404, code: 'WATCHLIST_ITEM_NOT_FOUND' });
  });
});

describe('When a watchlist repository fails unexpectedly', () => {
  it('should log the error with the service context and rethrow it', async () => {
    watchlistRepositoryRead.listWatchlistItems.mockRejectedValue(
      new Error('database down'),
    );
    watchlistRepositoryRead.countWatchlistItems.mockResolvedValue(0);
    const errorSpy = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => Logger);

    await expect(
      watchlistService.listWatchlistItems({
        filter: { userId: USER_ID },
        sort: EWatchlistSortField.ADDED_AT,
        pagination: { limit: 20, offset: 0 },
      }),
    ).rejects.toThrow('database down');
    expect(errorSpy).toHaveBeenCalledWith(
      'Unexpected error in WatchlistService.listWatchlistItems',
      expect.objectContaining({ eventName: 'service.unexpected_error' }),
    );
    errorSpy.mockRestore();
  });
});

describe('When we edit a watchlist item', () => {
  beforeEach(() => {
    watchlistRepositoryRead.findWatchlistItemById.mockResolvedValue(AN_ITEM);
    watchlistRepositoryWrite.updateWatchlistItemById.mockImplementation(
      async (id, userId, itemData) => ({ ...AN_ITEM, ...itemData }),
    );
  });

  it('should save the changed fields without the movie checks when it is the same movie', async () => {
    const updated = await watchlistService.updateWatchlistItem({
      id: 'item-1',
      userId: USER_ID,
      itemData: { priority: EWatchlistPriority.HIGH, note: 'Friday' },
    });

    expect(updated).toMatchObject({ priority: 'high', note: 'Friday' });
    expect(
      watchlistRepositoryRead.findDuplicateWatchlistItem,
    ).not.toHaveBeenCalled();
    expect(
      movieEntryRepositoryRead.findDuplicateMovieEntry,
    ).not.toHaveBeenCalled();
  });

  it('should check the new movie, ignoring the item itself', async () => {
    await watchlistService.updateWatchlistItem({
      id: 'item-1',
      userId: USER_ID,
      itemData: { title: 'Se7en' },
    });

    expect(
      watchlistRepositoryRead.findDuplicateWatchlistItem,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedTitle: 'se7en', excludeId: 'item-1' }),
    );
    expect(movieEntryRepositoryRead.findDuplicateMovieEntry).toHaveBeenCalled();
  });

  it('should reject a release year after next year', async () => {
    await expect(
      watchlistService.updateWatchlistItem({
        id: 'item-1',
        userId: USER_ID,
        itemData: { releaseYear: 2028 },
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_RELEASE_YEAR' });
    expect(watchlistRepositoryWrite.updateWatchlistItemById).not.toHaveBeenCalled();
  });

  it('should throw 404 when the item is missing or vanished before saving', async () => {
    watchlistRepositoryRead.findWatchlistItemById.mockResolvedValueOnce(null);
    await expect(
      watchlistService.updateWatchlistItem({
        id: 'item-1',
        userId: USER_ID,
        itemData: { note: 'x' },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'WATCHLIST_ITEM_NOT_FOUND' });

    watchlistRepositoryWrite.updateWatchlistItemById.mockResolvedValueOnce(null);
    await expect(
      watchlistService.updateWatchlistItem({
        id: 'item-1',
        userId: USER_ID,
        itemData: { note: 'x' },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('When a watchlist item has genres', () => {
  it('should save known genres', async () => {
    await watchlistService.addWatchlistItem({
      userId: USER_ID,
      title: 'Seven',
      genreIds: ['genre-1'],
    });

    expect(genreRepositoryRead.findGenresByIds).toHaveBeenCalledWith([
      'genre-1',
    ]);
    expect(watchlistRepositoryWrite.createWatchlistItem).toHaveBeenCalled();
  });

  it('should reject unknown genres or more than 5 with INVALID_GENRE', async () => {
    genreRepositoryRead.findGenresByIds.mockResolvedValueOnce([]);

    await expect(
      watchlistService.addWatchlistItem({
        userId: USER_ID,
        title: 'Seven',
        genreIds: ['unknown'],
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_GENRE' });
    await expect(
      watchlistService.addWatchlistItem({
        userId: USER_ID,
        title: 'Seven',
        genreIds: ['a', 'b', 'c', 'd', 'e', 'f'],
      }),
    ).rejects.toMatchObject({ code: 'INVALID_GENRE' });
    expect(watchlistRepositoryWrite.createWatchlistItem).not.toHaveBeenCalled();
  });
});
