import mongoose from 'mongoose';
import '../../../jest/setup-integration-tests';
import {
  EMovieEntrySortField,
  ESortOrder,
  IMovieEntryData,
} from '../../domain/movie-entry/interfaces/movie-entry.interface';
import { MovieEntry } from '../../domain/movie-entry/movie-entry.entity';
import { MmovieEntry } from '../../infrastructure/db/mongo/models/movie-entry.model';
import { MovieEntryRepositoryRead } from '../../infrastructure/repository/movie-entry/movie-entry.repository.read';
import { MovieEntryRepositoryWrite } from '../../infrastructure/repository/movie-entry/movie-entry.repository.write';
import { newObjectId } from '../testUtils';

const movieEntryRepositoryRead = new MovieEntryRepositoryRead();
const movieEntryRepositoryWrite = new MovieEntryRepositoryWrite();

const buildMovieEntry = (
  userId: string,
  overrides: Partial<ConstructorParameters<typeof MovieEntry>[0]> = {},
): IMovieEntryData =>
  new MovieEntry({
    userId,
    title: 'The Matrix',
    synopsis: 'A hacker learns the truth.',
    releaseYear: 1999,
    genreIds: [],
    rating: 5,
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    ...overrides,
  });

describe('When we create a movie entry', () => {
  it('should return it with string ids and find it only for its owner', async () => {
    const userId = newObjectId();
    const genreId = newObjectId();

    const created = await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { genreIds: [genreId] }),
    );
    const inDb = await MmovieEntry.findById(created._id).lean();

    expect(created._id).toMatch(/^[0-9a-f]{24}$/);
    expect(created.userId).toBe(userId);
    expect(created.genreIds).toEqual([genreId]);
    expect(inDb?.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(inDb?.genreIds[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    await expect(
      movieEntryRepositoryRead.findMovieEntryById(created._id, userId),
    ).resolves.toEqual(created);
    await expect(
      movieEntryRepositoryRead.findMovieEntryById(created._id, newObjectId()),
    ).resolves.toBeNull();
  });
});

describe('When we look for a duplicate movie entry', () => {
  it('should match by normalized title and year, or by tmdb id, ignoring the excluded entry', async () => {
    const userId = newObjectId();
    const created = await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { tmdbId: 603 }),
    );

    const byTitle = await movieEntryRepositoryRead.findDuplicateMovieEntry({
      userId,
      normalizedTitle: 'the matrix',
      releaseYear: 1999,
    });
    const byTmdbId = await movieEntryRepositoryRead.findDuplicateMovieEntry({
      userId,
      tmdbId: 603,
      normalizedTitle: 'another title',
      releaseYear: 2000,
    });
    const excluded = await movieEntryRepositoryRead.findDuplicateMovieEntry({
      userId,
      tmdbId: 603,
      normalizedTitle: 'the matrix',
      releaseYear: 1999,
      excludeId: created._id,
    });
    const otherUser = await movieEntryRepositoryRead.findDuplicateMovieEntry({
      userId: newObjectId(),
      normalizedTitle: 'the matrix',
      releaseYear: 1999,
    });

    expect(byTitle?._id).toBe(created._id);
    expect(byTmdbId?._id).toBe(created._id);
    expect(excluded).toBeNull();
    expect(otherUser).toBeNull();
  });

  it('should match only by tmdb id when there is no year', async () => {
    const userId = newObjectId();
    const created = await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { tmdbId: 604 }),
    );

    const byTmdbId = await movieEntryRepositoryRead.findDuplicateMovieEntry({
      userId,
      tmdbId: 604,
      normalizedTitle: 'another title',
    });
    const byTitleOnly =
      await movieEntryRepositoryRead.findDuplicateMovieEntry({
        userId,
        normalizedTitle: 'the matrix',
      });

    expect(byTmdbId?._id).toBe(created._id);
    expect(byTitleOnly).toBeNull();
  });
});

describe('When we list movie entries', () => {
  const userId = newObjectId();
  const dramaId = newObjectId();

  beforeAll(async () => {
    await Promise.all([
      movieEntryRepositoryWrite.createMovieEntry(
        buildMovieEntry(userId, {
          title: 'Ágape',
          rating: 3,
          genreIds: [dramaId],
        }),
      ),
      movieEntryRepositoryWrite.createMovieEntry(
        buildMovieEntry(userId, { title: 'Avatar', rating: 4, isFavorite: true }),
      ),
      movieEntryRepositoryWrite.createMovieEntry(
        buildMovieEntry(userId, {
          title: 'Batman',
          rating: 5,
          genreIds: [dramaId],
        }),
      ),
    ]);
  });

  it('should sort by normalized title and paginate', async () => {
    const page = await movieEntryRepositoryRead.listMovieEntries(
      { userId },
      { field: EMovieEntrySortField.TITLE, order: ESortOrder.ASC },
      { limit: 2, offset: 1 },
    );

    expect(page.map((entry) => entry.title)).toEqual(['Avatar', 'Batman']);
  });

  it('should filter by search, genre, rating range and favorite', async () => {
    const titlesFor = async (filter: object) =>
      (
        await movieEntryRepositoryRead.listMovieEntries(
          { userId, ...filter },
          { field: EMovieEntrySortField.RATING, order: ESortOrder.DESC },
          { limit: 10, offset: 0 },
        )
      ).map((entry) => entry.title);

    await expect(titlesFor({ search: 'AGA' })).resolves.toEqual(['Ágape']);
    await expect(titlesFor({ genreId: dramaId })).resolves.toEqual([
      'Batman',
      'Ágape',
    ]);
    await expect(titlesFor({ minRating: 4, maxRating: 4 })).resolves.toEqual([
      'Avatar',
    ]);
    await expect(titlesFor({ favorite: true })).resolves.toEqual(['Avatar']);
    await expect(titlesFor({ search: '.*' })).resolves.toEqual([]);
    await expect(
      movieEntryRepositoryRead.countMovieEntries({ userId, genreId: dramaId }),
    ).resolves.toBe(2);
  });
});

describe('When we update a movie entry', () => {
  it('should set the given fields and unset the ones sent as undefined', async () => {
    const userId = newObjectId();
    const created = await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, {
        posterUrl: 'https://cdn.example.com/poster.png',
        posterPublicId: 'posters/1',
      }),
    );

    const updated = await movieEntryRepositoryWrite.updateMovieEntryById(
      created._id,
      userId,
      { rating: 2, posterUrl: undefined, posterPublicId: undefined },
    );
    const inDb = await MmovieEntry.findById(created._id).lean();

    expect(updated?.rating).toBe(2);
    expect(updated).not.toHaveProperty('posterUrl');
    expect(inDb).not.toHaveProperty('posterPublicId');
    await expect(
      movieEntryRepositoryWrite.updateMovieEntryById(
        created._id,
        newObjectId(),
        { rating: 1 },
      ),
    ).resolves.toBeNull();
  });
});

describe('When we delete movie entries', () => {
  it('should delete one entry only for its owner', async () => {
    const userId = newObjectId();
    const created = await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId),
    );

    await expect(
      movieEntryRepositoryWrite.deleteMovieEntryById(created._id, newObjectId()),
    ).resolves.toBeNull();
    await expect(
      movieEntryRepositoryWrite.deleteMovieEntryById(created._id, userId),
    ).resolves.toEqual(created);
    await expect(MmovieEntry.findById(created._id)).resolves.toBeNull();
  });

  it('should delete every entry of a user and return them', async () => {
    const userId = newObjectId();
    await movieEntryRepositoryWrite.createMovieEntry(buildMovieEntry(userId));
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { title: 'Other' }),
    );

    const deleted =
      await movieEntryRepositoryWrite.deleteMovieEntriesByUserId(userId);

    expect(deleted).toHaveLength(2);
    await expect(
      MmovieEntry.countDocuments({ userId: deleted[0].userId }),
    ).resolves.toBe(0);
  });
});

describe('When we compute the stats of a user', () => {
  it('should aggregate totals, distributions and top genres', async () => {
    const userId = newObjectId();
    const genre = await mongoose.connection
      .collection('genres')
      .findOneAndUpdate(
        { tmdbGenreId: 18 },
        { $setOnInsert: { name: 'Drama' } },
        { upsert: true, returnDocument: 'after' },
      );
    const genreId = genre!._id;
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, {
        rating: 5,
        durationMinutes: 120,
        isFavorite: true,
        genreIds: [genreId.toString()],
        watchedAt: new Date('2026-03-05T00:00:00.000Z'),
      }),
    );
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, {
        title: 'Old one',
        rating: 2.5,
        watchedAt: new Date('2025-01-05T00:00:00.000Z'),
      }),
    );

    const stats = await movieEntryRepositoryRead.getUserStats(
      userId,
      new Date('2026-01-01T00:00:00.000Z'),
    );

    expect(stats).toEqual({
      totalMovies: 2,
      averageRating: 3.8,
      favoritesCount: 1,
      totalMinutes: 120,
      ratingDistribution: [
        { rating: 2.5, count: 1 },
        { rating: 5, count: 1 },
      ],
      moviesPerMonth: [{ month: '2026-03', count: 1 }],
      topGenres: [{ genreId: genreId.toString(), name: 'Drama', count: 1 }],
    });
  });

  it('should return empty stats for a user without entries', async () => {
    await expect(
      movieEntryRepositoryRead.getUserStats(newObjectId(), new Date(0)),
    ).resolves.toMatchObject({ totalMovies: 0, averageRating: null });
  });

  it('should summarize entries per user', async () => {
    const userId = newObjectId();
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { rating: 4, isFavorite: true }),
    );

    await expect(
      movieEntryRepositoryRead.getSummariesByUserIds([userId, 'not-an-id']),
    ).resolves.toEqual([
      { userId, moviesCount: 1, averageRating: 4, favoritesCount: 1 },
    ]);
  });

  it('should round the average half up, not half to even', async () => {
    const userId = newObjectId();
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { rating: 8 }),
    );
    await movieEntryRepositoryWrite.createMovieEntry(
      buildMovieEntry(userId, { rating: 6.5, title: 'Another movie' }),
    );

    const stats = await movieEntryRepositoryRead.getUserStats(
      userId,
      new Date(0),
    );
    const [summary] = await movieEntryRepositoryRead.getSummariesByUserIds([
      userId,
    ]);

    expect(stats.averageRating).toBe(7.3);
    expect(summary.averageRating).toBe(7.3);
  });
});

describe('When we use ids that are not ObjectIds', () => {
  it('should return empty results instead of failing the cast', async () => {
    const userId = newObjectId();

    await expect(
      movieEntryRepositoryRead.findMovieEntryById('bad', userId),
    ).resolves.toBeNull();
    await expect(
      movieEntryRepositoryRead.listMovieEntries(
        { userId: 'bad' },
        { field: EMovieEntrySortField.WATCHED_AT, order: ESortOrder.DESC },
        { limit: 10, offset: 0 },
      ),
    ).resolves.toEqual([]);
    await expect(
      movieEntryRepositoryRead.countMovieEntries({ userId, genreId: 'bad' }),
    ).resolves.toBe(0);
    await expect(
      movieEntryRepositoryWrite.deleteMovieEntryById(newObjectId(), 'bad'),
    ).resolves.toBeNull();
  });
});
