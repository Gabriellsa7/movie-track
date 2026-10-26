import { FilterQuery, SortOrder } from 'mongoose';
import { IPagination } from '../../../domain/common/pagination.interface';
import { normalizeText } from '../../../domain/common/text.normalizer';
import {
  EMovieEntrySortField,
  ESortOrder,
  IMovieEntry,
  IMovieEntryFilter,
  IMovieEntrySort,
  IUserStats,
} from '../../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryRepositoryRead } from '../../../domain/movie-entry/repository/movie-entry.repository.read';
import { MmovieEntry } from '../../db/mongo/models/movie-entry.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMMovieEntry } from '../../db/mongo/schema/movie-entry.schema';
import { toMovieEntry } from './movie-entry.mapper';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
const TOP_GENRES_LIMIT = 5;
const GENRE_COLLECTION = 'genres';

// Title sorts on the normalized value so "ágape" and "Avatar" sort as a reader expects.
const SORT_FIELDS: Record<EMovieEntrySortField, keyof IMMovieEntry> = {
  [EMovieEntrySortField.WATCHED_AT]: 'watchedAt',
  [EMovieEntrySortField.RATING]: 'rating',
  [EMovieEntrySortField.TITLE]: 'normalizedTitle',
  [EMovieEntrySortField.RELEASE_YEAR]: 'releaseYear',
};

interface IStatsFacet {
  totals: { totalMovies: number; averageRating: number | null; favoritesCount: number; totalMinutes: number }[];
  ratingDistribution: { rating: number; count: number }[];
  moviesPerMonth: { month: string; count: number }[];
  topGenres: { genreId: string; name: string; count: number }[];
}

export class MovieEntryRepositoryRead implements IMovieEntryRepositoryRead {
  async findMovieEntryById(
    id: string,
    userId: string,
  ): Promise<IMovieEntry | null> {
    if (!isObjectId(id) || !isObjectId(userId)) {
      return null;
    }
    const movieEntry = await MmovieEntry.findOne(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMMovieEntry>();
    return movieEntry && toMovieEntry(movieEntry);
  }

  async findDuplicateMovieEntry(params: {
    userId: string;
    tmdbId?: number;
    normalizedTitle: string;
    releaseYear?: number;
    excludeId?: string;
  }): Promise<IMovieEntry | null> {
    if (!isObjectId(params.userId)) {
      return null;
    }
    const sameMovie: FilterQuery<IMMovieEntry>[] = [];
    if (params.releaseYear !== undefined) {
      sameMovie.push({
        normalizedTitle: params.normalizedTitle,
        releaseYear: params.releaseYear,
      });
    }
    if (params.tmdbId !== undefined) {
      sameMovie.push({ tmdbId: params.tmdbId });
    }
    if (sameMovie.length === 0) {
      return null;
    }

    const filter: FilterQuery<IMMovieEntry> = {
      userId: toObjectId(params.userId),
      $or: sameMovie,
    };
    if (params.excludeId && isObjectId(params.excludeId)) {
      filter._id = { $ne: toObjectId(params.excludeId) };
    }

    const movieEntry = await MmovieEntry.findOne(
      filter,
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMMovieEntry>();
    return movieEntry && toMovieEntry(movieEntry);
  }

  async listMovieEntries(
    filter: IMovieEntryFilter,
    sort: IMovieEntrySort,
    pagination: IPagination,
  ): Promise<IMovieEntry[]> {
    if (!isObjectId(filter.userId)) {
      return [];
    }
    const order: SortOrder = sort.order === ESortOrder.ASC ? 1 : -1;
    const movieEntries = await MmovieEntry.find(
      this.buildFilter(filter),
      HIDE_MONGO_INTERNAL_FIELDS,
    )
      .sort({ [SORT_FIELDS[sort.field]]: order, _id: order })
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean<IMMovieEntry[]>();
    return movieEntries.map(toMovieEntry);
  }

  async countMovieEntries(filter: IMovieEntryFilter): Promise<number> {
    if (!isObjectId(filter.userId)) {
      return 0;
    }
    return MmovieEntry.countDocuments(this.buildFilter(filter));
  }

  async getUserStats(userId: string, since: Date): Promise<IUserStats> {
    const emptyStats: IUserStats = {
      totalMovies: 0,
      averageRating: null,
      favoritesCount: 0,
      ratingDistribution: [],
      moviesPerMonth: [],
      topGenres: [],
      totalMinutes: 0,
    };
    if (!isObjectId(userId)) {
      return emptyStats;
    }

    const [stats] = await MmovieEntry.aggregate<IStatsFacet>([
      { $match: { userId: toObjectId(userId) } },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalMovies: { $sum: 1 },
                averageRating: { $avg: '$rating' },
                favoritesCount: { $sum: { $cond: ['$isFavorite', 1, 0] } },
                totalMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                totalMovies: 1,
                averageRating: { $round: ['$averageRating', 1] },
                favoritesCount: 1,
                totalMinutes: 1,
              },
            },
          ],
          ratingDistribution: [
            { $group: { _id: '$rating', count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, rating: '$_id', count: 1 } },
          ],
          moviesPerMonth: [
            { $match: { watchedAt: { $gte: since } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m', date: '$watchedAt' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, month: '$_id', count: 1 } },
          ],
          topGenres: [
            { $unwind: '$genreIds' },
            { $group: { _id: '$genreIds', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
            { $limit: TOP_GENRES_LIMIT },
            {
              $lookup: {
                from: GENRE_COLLECTION,
                localField: '_id',
                foreignField: '_id',
                as: 'genre',
              },
            },
            { $unwind: '$genre' },
            {
              $project: {
                _id: 0,
                genreId: { $toString: '$_id' },
                name: '$genre.name',
                count: 1,
              },
            },
          ],
        },
      },
    ]);

    const [totals] = stats.totals;
    if (!totals) {
      return emptyStats;
    }
    return {
      ...totals,
      ratingDistribution: stats.ratingDistribution,
      moviesPerMonth: stats.moviesPerMonth,
      topGenres: stats.topGenres,
    };
  }

  async getSummariesByUserIds(userIds: string[]): Promise<
    {
      userId: string;
      moviesCount: number;
      averageRating: number | null;
      favoritesCount: number;
    }[]
  > {
    const validUserIds = userIds.filter(isObjectId).map(toObjectId);
    if (!validUserIds.length) {
      return [];
    }
    return MmovieEntry.aggregate([
      { $match: { userId: { $in: validUserIds } } },
      {
        $group: {
          _id: '$userId',
          moviesCount: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          favoritesCount: { $sum: { $cond: ['$isFavorite', 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          userId: { $toString: '$_id' },
          moviesCount: 1,
          averageRating: { $round: ['$averageRating', 1] },
          favoritesCount: 1,
        },
      },
    ]);
  }

  private buildFilter(filter: IMovieEntryFilter): FilterQuery<IMMovieEntry> {
    const query: FilterQuery<IMMovieEntry> = {
      userId: toObjectId(filter.userId),
    };

    const normalizedSearch = filter.search ? normalizeText(filter.search) : '';
    if (normalizedSearch) {
      query.normalizedTitle = {
        $regex: normalizedSearch.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'),
      };
    }

    if (filter.genreId !== undefined) {
      if (!isObjectId(filter.genreId)) {
        return { _id: { $exists: false } };
      }
      query.genreIds = toObjectId(filter.genreId);
    }

    if (filter.minRating !== undefined || filter.maxRating !== undefined) {
      query.rating = {
        ...(filter.minRating !== undefined && { $gte: filter.minRating }),
        ...(filter.maxRating !== undefined && { $lte: filter.maxRating }),
      };
    }

    if (filter.favorite !== undefined) {
      query.isFavorite = filter.favorite;
    }

    return query;
  }
}
