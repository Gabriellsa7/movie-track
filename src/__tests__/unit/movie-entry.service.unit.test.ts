import { EWatchlistPriority } from '../../domain/watchlist/interfaces/watchlist.interface';
import { IUserRepositoryRead } from '../../domain/user/repository/user.repository.read';
import { Logger } from 'traceability';
import { IClock } from '../../domain/common/providers/clock.provider';
import { IStorageProvider } from '../../domain/common/providers/storage.provider';
import { IGenreRepositoryRead } from '../../domain/genre/repository/genre.repository.read';
import {
  EMovieEntrySortField,
  ESortOrder,
  IMovieEntry,
} from '../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryRepositoryRead } from '../../domain/movie-entry/repository/movie-entry.repository.read';
import { IMovieEntryRepositoryWrite } from '../../domain/movie-entry/repository/movie-entry.repository.write';
import { MovieEntryService } from '../../domain/movie-entry/service/movie-entry.service';
import { IWatchlistRepositoryRead } from '../../domain/watchlist/repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../../domain/watchlist/repository/watchlist.repository.write';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const USER_ID = 'user-1';

const A_MOVIE_ENTRY: IMovieEntry = {
  _id: 'entry-1',
  userId: USER_ID,
  title: 'The Matrix',
  normalizedTitle: 'the matrix',
  synopsis: 'A hacker learns the truth.',
  releaseYear: 1999,
  genreIds: ['genre-1'],
  rating: 5,
  watchedAt: new Date('2026-01-01T00:00:00.000Z'),
  isFavorite: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const WITH_UPLOADED_POSTER: IMovieEntry = {
  ...A_MOVIE_ENTRY,
  posterUrl: 'https://cdn.example.com/old.png',
  posterPublicId: 'posters/old',
};

const CREATE_PARAMS = {
  userId: USER_ID,
  title: '  The Matrix ',
  synopsis: 'A hacker learns the truth.',
  releaseYear: 1999,
  genreIds: ['genre-1', 'genre-1'],
  rating: 5,
};

let userRepositoryRead: jest.Mocked<
  Pick<IUserRepositoryRead, 'findUserById'>
>;
let movieEntryRepositoryRead: jest.Mocked<IMovieEntryRepositoryRead>;
let movieEntryRepositoryWrite: jest.Mocked<IMovieEntryRepositoryWrite>;
let genreRepositoryRead: jest.Mocked<IGenreRepositoryRead>;
let watchlistRepositoryRead: jest.Mocked<IWatchlistRepositoryRead>;
let watchlistRepositoryWrite: jest.Mocked<IWatchlistRepositoryWrite>;
let storageProvider: jest.Mocked<IStorageProvider>;
let clock: jest.Mocked<IClock>;
let movieEntryService: MovieEntryService;

beforeEach(() => {
  movieEntryRepositoryRead = {
    findMovieEntryById: jest.fn(),
    findDuplicateMovieEntry: jest.fn().mockResolvedValue(null),
    listMovieEntries: jest.fn(),
    countMovieEntries: jest.fn(),
    getUserStats: jest.fn(),
    getSummariesByUserIds: jest.fn(),
  };
  movieEntryRepositoryWrite = {
    createMovieEntry: jest.fn(async (movieData) => ({
      ...movieData,
      _id: 'entry-1',
    })),
    updateMovieEntryById: jest.fn(async (id, userId, movieData) => ({
      ...A_MOVIE_ENTRY,
      ...movieData,
    })),
    deleteMovieEntryById: jest.fn(),
    deleteMovieEntriesByUserId: jest.fn(),
  };
  genreRepositoryRead = {
    listGenres: jest.fn(),
    findGenresByIds: jest.fn(async (ids: string[]) =>
      ids.map((id) => ({ _id: id, name: 'Drama', tmdbGenreId: 18 })),
    ),
    findGenresByTmdbIds: jest.fn(),
  };
  watchlistRepositoryRead = {
    findWatchlistItemById: jest.fn(),
    findDuplicateWatchlistItem: jest.fn(),
    listWatchlistItems: jest.fn(),
    countWatchlistItems: jest.fn(),
  };
  watchlistRepositoryWrite = {
    createWatchlistItem: jest.fn(),
    updateWatchlistItemById: jest.fn(),
    deleteWatchlistItemById: jest.fn(),
    deleteWatchlistItemsByUserId: jest.fn(),
  };
  storageProvider = {
    upload: jest.fn().mockResolvedValue({
      url: 'https://cdn.example.com/new.png',
      publicId: 'posters/new',
    }),
    delete: jest.fn(),
  };
  userRepositoryRead = {
    findUserById: jest.fn().mockResolvedValue({ _id: 'user-1' }),
  };
  clock = { now: jest.fn(() => NOW) };
  movieEntryService = new MovieEntryService({
    movieEntryRepositoryRead,
    movieEntryRepositoryWrite,
    genreRepositoryRead,
    watchlistRepositoryRead,
    watchlistRepositoryWrite,
    storageProvider,
    userRepositoryRead:
      userRepositoryRead as unknown as IUserRepositoryRead,
    clock,
  });
});

describe('When the token belongs to a deleted account', () => {
  it('should reject the creation with 401 INVALID_TOKEN and save nothing', async () => {
    userRepositoryRead.findUserById.mockResolvedValue(null);

    await expect(movieEntryService.createMovieEntry(CREATE_PARAMS)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_TOKEN',
    });
    expect(movieEntryRepositoryWrite.createMovieEntry).not.toHaveBeenCalled();
  });
});

describe('When we create a movie entry', () => {
  it('should persist the normalized entry with server-side defaults', async () => {
    const created = await movieEntryService.createMovieEntry(CREATE_PARAMS);

    const persisted = movieEntryRepositoryWrite.createMovieEntry.mock.calls[0][0];
    expect(persisted).toMatchObject({
      title: 'The Matrix',
      normalizedTitle: 'the matrix',
      genreIds: ['genre-1'],
      isFavorite: false,
      watchedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(persisted).not.toHaveProperty('_id');
    expect(created._id).toBe('entry-1');
    expect(genreRepositoryRead.findGenresByIds).toHaveBeenCalledWith([
      'genre-1',
    ]);
  });

  it('should throw INVALID_GENRE when a genre does not exist', async () => {
    genreRepositoryRead.findGenresByIds.mockResolvedValue([]);

    await expect(
      movieEntryService.createMovieEntry(CREATE_PARAMS),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_GENRE' });
    expect(movieEntryRepositoryWrite.createMovieEntry).not.toHaveBeenCalled();
  });

  it.each([
    ['no genre', []],
    ['more than 5 genres', ['g1', 'g2', 'g3', 'g4', 'g5', 'g6']],
  ])('should throw INVALID_GENRE with %s', async (_case, genreIds) => {
    await expect(
      movieEntryService.createMovieEntry({ ...CREATE_PARAMS, genreIds }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_GENRE' });
    expect(genreRepositoryRead.findGenresByIds).not.toHaveBeenCalled();
  });

  it.each([0.5, 10.5, 7.3])(
    'should throw INVALID_RATING for rating %d',
    async (rating) => {
      await expect(
        movieEntryService.createMovieEntry({ ...CREATE_PARAMS, rating }),
      ).rejects.toMatchObject({ status: 422, code: 'INVALID_RATING' });
    },
  );

  it('should accept ratings in steps of 0.5 between 1 and 10', async () => {
    await expect(
      movieEntryService.createMovieEntry({ ...CREATE_PARAMS, rating: 7.5 }),
    ).resolves.toMatchObject({ rating: 7.5 });
  });

  it('should throw INVALID_RELEASE_YEAR after next year', async () => {
    await expect(
      movieEntryService.createMovieEntry({
        ...CREATE_PARAMS,
        releaseYear: 2028,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_RELEASE_YEAR' });
  });

  it('should throw INVALID_WATCHED_AT for a date in the future', async () => {
    await expect(
      movieEntryService.createMovieEntry({
        ...CREATE_PARAMS,
        watchedAt: new Date('2026-10-16T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_WATCHED_AT' });
  });

  it('should throw ConflictError when the movie is already logged', async () => {
    movieEntryRepositoryRead.findDuplicateMovieEntry.mockResolvedValue(
      A_MOVIE_ENTRY,
    );

    await expect(
      movieEntryService.createMovieEntry({ ...CREATE_PARAMS, tmdbId: 603 }),
    ).rejects.toMatchObject({ status: 409, code: 'MOVIE_ALREADY_LOGGED' });
    expect(movieEntryRepositoryRead.findDuplicateMovieEntry).toHaveBeenCalledWith(
      {
        userId: USER_ID,
        tmdbId: 603,
        normalizedTitle: 'the matrix',
        releaseYear: 1999,
        excludeId: undefined,
      },
    );
  });

  it('should remove the watchlist item it came from', async () => {
    watchlistRepositoryRead.findWatchlistItemById.mockResolvedValue({
      _id: 'item-1',
      userId: USER_ID,
      title: 'The Matrix',
      normalizedTitle: 'the matrix',
      addedAt: NOW,
      priority: EWatchlistPriority.MEDIUM,
    });

    await movieEntryService.createMovieEntry({
      ...CREATE_PARAMS,
      watchlistItemId: 'item-1',
    });

    expect(watchlistRepositoryWrite.deleteWatchlistItemById).toHaveBeenCalledWith(
      'item-1',
      USER_ID,
    );
  });

  it('should throw NotFoundError when the watchlist item does not exist', async () => {
    watchlistRepositoryRead.findWatchlistItemById.mockResolvedValue(null);

    await expect(
      movieEntryService.createMovieEntry({
        ...CREATE_PARAMS,
        watchlistItemId: 'missing',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'WATCHLIST_ITEM_NOT_FOUND' });
    expect(movieEntryRepositoryWrite.createMovieEntry).not.toHaveBeenCalled();
  });
});

describe('When we get a movie entry', () => {
  it('should return the entry of the user', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);

    await expect(
      movieEntryService.getMovieEntryById('entry-1', USER_ID),
    ).resolves.toEqual(A_MOVIE_ENTRY);
    expect(movieEntryRepositoryRead.findMovieEntryById).toHaveBeenCalledWith(
      'entry-1',
      USER_ID,
    );
  });

  it('should throw NotFoundError when it does not exist', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(null);

    await expect(
      movieEntryService.getMovieEntryById('missing', USER_ID),
    ).rejects.toMatchObject({ status: 404, code: 'MOVIE_NOT_FOUND' });
  });
});

describe('When we list movie entries', () => {
  it('should return the page with its metadata', async () => {
    movieEntryRepositoryRead.listMovieEntries.mockResolvedValue([A_MOVIE_ENTRY]);
    movieEntryRepositoryRead.countMovieEntries.mockResolvedValue(21);
    const params = {
      filter: { userId: USER_ID },
      sort: { field: EMovieEntrySortField.RATING, order: ESortOrder.DESC },
      pagination: { limit: 10, offset: 20 },
    };

    await expect(movieEntryService.listMovieEntries(params)).resolves.toEqual({
      items: [A_MOVIE_ENTRY],
      total: 21,
      page: 3,
      limit: 10,
    });
  });
});

describe('When we list movie entries with invalid filters', () => {
  const sort = { field: EMovieEntrySortField.WATCHED_AT, order: ESortOrder.DESC };
  const pagination = { limit: 20, offset: 0 };

  it('should throw INVALID_RATING_RANGE when minRating is above maxRating', async () => {
    await expect(
      movieEntryService.listMovieEntries({
        filter: { userId: USER_ID, minRating: 8, maxRating: 4 },
        sort,
        pagination,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_RATING_RANGE' });
  });

  it('should throw INVALID_GENRE when the genre does not exist', async () => {
    genreRepositoryRead.findGenresByIds.mockResolvedValue([]);

    await expect(
      movieEntryService.listMovieEntries({
        filter: { userId: USER_ID, genreId: 'missing' },
        sort,
        pagination,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_GENRE' });
    expect(movieEntryRepositoryRead.listMovieEntries).not.toHaveBeenCalled();
  });
});

describe('When we update a movie entry', () => {
  const movieData = {
    title: 'The Matrix Reloaded',
    synopsis: 'Neo returns.',
    releaseYear: 2003,
    genreIds: ['genre-1'],
    rating: 4,
  };

  it('should save the new details, keep a normalized title and exclude itself from the duplicate check', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);

    await movieEntryService.updateMovieEntry({
      id: 'entry-1',
      userId: USER_ID,
      movieData,
    });

    expect(movieEntryRepositoryWrite.updateMovieEntryById).toHaveBeenCalledWith(
      'entry-1',
      USER_ID,
      expect.objectContaining({
        title: 'The Matrix Reloaded',
        normalizedTitle: 'the matrix reloaded',
        rating: 4,
        updatedAt: NOW,
      }),
    );
    expect(
      movieEntryRepositoryRead.findDuplicateMovieEntry,
    ).toHaveBeenCalledWith(expect.objectContaining({ excludeId: 'entry-1' }));
  });

  it('should remove an uploaded poster from storage when posterUrl is null', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    await movieEntryService.updateMovieEntry({
      id: 'entry-1',
      userId: USER_ID,
      movieData: { ...movieData, posterUrl: null },
    });

    const saved = movieEntryRepositoryWrite.updateMovieEntryById.mock.calls[0][2];
    expect(saved).toHaveProperty('posterUrl', undefined);
    expect(saved).toHaveProperty('posterPublicId', undefined);
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/old');
  });

  it('should swap an uploaded poster for an external URL', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    await movieEntryService.updateMovieEntry({
      id: 'entry-1',
      userId: USER_ID,
      movieData: { ...movieData, posterUrl: 'https://img.example.com/p.png' },
    });

    const saved = movieEntryRepositoryWrite.updateMovieEntryById.mock.calls[0][2];
    expect(saved.posterUrl).toBe('https://img.example.com/p.png');
    expect(saved.posterPublicId).toBeUndefined();
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/old');
  });

  it('should keep the poster when posterUrl is not sent', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    await movieEntryService.updateMovieEntry({
      id: 'entry-1',
      userId: USER_ID,
      movieData,
    });

    expect(storageProvider.delete).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError when the entry disappears before saving', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);
    movieEntryRepositoryWrite.updateMovieEntryById.mockResolvedValue(null);

    await expect(
      movieEntryService.updateMovieEntry({
        id: 'entry-1',
        userId: USER_ID,
        movieData,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('When we set a movie entry as favorite', () => {
  it('should save the flag and the update date', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);

    const updated = await movieEntryService.setFavorite({
      id: 'entry-1',
      userId: USER_ID,
      isFavorite: true,
    });

    expect(updated).toMatchObject({ isFavorite: true, updatedAt: NOW });
  });
});

describe('When we delete a movie entry', () => {
  it('should delete it and its uploaded poster', async () => {
    movieEntryRepositoryWrite.deleteMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    await movieEntryService.deleteMovieEntry('entry-1', USER_ID);

    expect(storageProvider.delete).toHaveBeenCalledWith('posters/old');
  });

  it('should not fail when the poster cannot be deleted from storage', async () => {
    const warn = jest.spyOn(Logger, 'warn').mockImplementation();
    movieEntryRepositoryWrite.deleteMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );
    storageProvider.delete.mockRejectedValue(new Error('storage down'));

    await expect(
      movieEntryService.deleteMovieEntry('entry-1', USER_ID),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Failed to delete a poster from storage',
      expect.objectContaining({
        eventName: 'movie-entry.poster.delete_failed',
        publicId: 'posters/old',
      }),
    );
  });

  it('should throw NotFoundError when it does not exist', async () => {
    movieEntryRepositoryWrite.deleteMovieEntryById.mockResolvedValue(null);

    await expect(
      movieEntryService.deleteMovieEntry('missing', USER_ID),
    ).rejects.toMatchObject({ status: 404, code: 'MOVIE_NOT_FOUND' });
  });
});

describe('When we upload a poster', () => {
  const uploadParams = {
    id: 'entry-1',
    userId: USER_ID,
    buffer: Buffer.from('image'),
    mimeType: 'image/png',
  };

  it('should store the file, save its url and delete the previous one', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    const updated = await movieEntryService.uploadPoster(uploadParams);

    expect(storageProvider.upload).toHaveBeenCalledWith({
      buffer: uploadParams.buffer,
      mimeType: 'image/png',
      folder: 'posters',
    });
    expect(updated).toMatchObject({
      posterUrl: 'https://cdn.example.com/new.png',
      posterPublicId: 'posters/new',
    });
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/old');
  });

  it('should delete the uploaded file when the entry cannot be saved', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);
    movieEntryRepositoryWrite.updateMovieEntryById.mockResolvedValue(null);

    await expect(movieEntryService.uploadPoster(uploadParams)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/new');
  });

  it('should not upload anything when the entry does not exist', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(null);

    await expect(movieEntryService.uploadPoster(uploadParams)).rejects.toMatchObject(
      { status: 404 },
    );
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it('should reject a file that is not a JPEG, PNG or WebP image', async () => {
    await expect(
      movieEntryService.uploadPoster({ ...uploadParams, mimeType: 'image/gif' }),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_POSTER_TYPE' });
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });
});

describe('When we remove a poster', () => {
  it('should clear the poster fields and delete the stored file', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(
      WITH_UPLOADED_POSTER,
    );

    const updated = await movieEntryService.removePoster('entry-1', USER_ID);

    expect(updated.posterUrl).toBeUndefined();
    expect(storageProvider.delete).toHaveBeenCalledWith('posters/old');
  });
});

describe('When we remove a poster that does not exist', () => {
  it('should return the entry without saving or deleting anything', async () => {
    movieEntryRepositoryRead.findMovieEntryById.mockResolvedValue(A_MOVIE_ENTRY);

    await expect(
      movieEntryService.removePoster('entry-1', USER_ID),
    ).resolves.toEqual(A_MOVIE_ENTRY);
    expect(movieEntryRepositoryWrite.updateMovieEntryById).not.toHaveBeenCalled();
    expect(storageProvider.delete).not.toHaveBeenCalled();
  });
});

describe('When we get the stats of a user', () => {
  it('should ask for the last 12 months starting on the first day of the month', async () => {
    movieEntryRepositoryRead.getUserStats.mockResolvedValue({
      totalMovies: 0,
      averageRating: null,
      favoritesCount: 0,
      ratingDistribution: [],
      moviesPerMonth: [],
      topGenres: [],
      totalMinutes: 0,
    });

    await movieEntryService.getUserStats(USER_ID);

    expect(movieEntryRepositoryRead.getUserStats).toHaveBeenCalledWith(
      USER_ID,
      new Date('2025-11-01T00:00:00.000Z'),
    );
  });
});
