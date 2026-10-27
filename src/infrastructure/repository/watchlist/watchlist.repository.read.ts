import { FilterQuery } from 'mongoose';
import { IPagination } from '../../../domain/common/pagination.interface';
import { normalizeText } from '../../../domain/common/text.normalizer';
import {
  EWatchlistPriority,
  EWatchlistSortField,
  IWatchlistFilter,
  IWatchlistItem,
} from '../../../domain/watchlist/interfaces/watchlist.interface';
import { IWatchlistRepositoryRead } from '../../../domain/watchlist/repository/watchlist.repository.read';
import { Mwatchlist } from '../../db/mongo/models/watchlist.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMWatchlistItem } from '../../db/mongo/schema/watchlist.schema';
import { toWatchlistItem } from './watchlist.mapper';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;
// Sorting by priority puts high first; a missing priority sorts as medium.
const PRIORITY_RANK = {
  $switch: {
    branches: [
      { case: { $eq: ['$priority', EWatchlistPriority.HIGH] }, then: 0 },
      { case: { $eq: ['$priority', EWatchlistPriority.LOW] }, then: 2 },
    ],
    default: 1,
  },
};

export class WatchlistRepositoryRead implements IWatchlistRepositoryRead {
  async findWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null> {
    if (!isObjectId(id) || !isObjectId(userId)) {
      return null;
    }
    const item = await Mwatchlist.findOne(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMWatchlistItem>();
    return item && toWatchlistItem(item);
  }

  async findDuplicateWatchlistItem(params: {
    userId: string;
    tmdbId?: number;
    normalizedTitle: string;
    releaseYear?: number;
    excludeId?: string;
  }): Promise<IWatchlistItem | null> {
    if (!isObjectId(params.userId)) {
      return null;
    }
    // null also matches items saved without a releaseYear.
    const sameMovie: FilterQuery<IMWatchlistItem>[] = [
      {
        normalizedTitle: params.normalizedTitle,
        releaseYear: params.releaseYear ?? null,
      },
    ];
    if (params.tmdbId !== undefined) {
      sameMovie.push({ tmdbId: params.tmdbId });
    }

    const filter: FilterQuery<IMWatchlistItem> = {
      userId: toObjectId(params.userId),
      $or: sameMovie,
    };
    if (params.excludeId && isObjectId(params.excludeId)) {
      filter._id = { $ne: toObjectId(params.excludeId) };
    }
    const item = await Mwatchlist.findOne(
      filter,
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMWatchlistItem>();
    return item && toWatchlistItem(item);
  }

  async listWatchlistItems(
    filter: IWatchlistFilter,
    sort: EWatchlistSortField,
    pagination: IPagination,
  ): Promise<IWatchlistItem[]> {
    if (!isObjectId(filter.userId)) {
      return [];
    }
    const items = await Mwatchlist.aggregate<IMWatchlistItem>([
      { $match: this.buildFilter(filter) },
      ...(sort === EWatchlistSortField.PRIORITY
        ? [
            { $addFields: { priorityRank: PRIORITY_RANK } },
            { $sort: { priorityRank: 1, addedAt: -1, _id: -1 } as const },
          ]
        : [{ $sort: { addedAt: -1, _id: -1 } as const }]),
      { $skip: pagination.offset },
      { $limit: pagination.limit },
      { $project: { priorityRank: 0, ...HIDE_MONGO_INTERNAL_FIELDS } },
    ]);
    return items.map(toWatchlistItem);
  }

  async countWatchlistItems(filter: IWatchlistFilter): Promise<number> {
    if (!isObjectId(filter.userId)) {
      return 0;
    }
    return Mwatchlist.countDocuments(this.buildFilter(filter));
  }

  private buildFilter(filter: IWatchlistFilter): FilterQuery<IMWatchlistItem> {
    const query: FilterQuery<IMWatchlistItem> = {
      userId: toObjectId(filter.userId),
    };
    const normalizedSearch = filter.search ? normalizeText(filter.search) : '';
    if (normalizedSearch) {
      query.normalizedTitle = {
        $regex: normalizedSearch.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'),
      };
    }
    if (filter.priority) {
      // A missing priority reads as medium (items saved before priorities existed).
      query.priority =
        filter.priority === EWatchlistPriority.MEDIUM
          ? { $in: [EWatchlistPriority.MEDIUM, null] }
          : filter.priority;
    }
    return query;
  }
}
