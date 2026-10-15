import { FilterQuery } from 'mongoose';
import { IPagination } from '../../../domain/common/pagination.interface';
import { normalizeText } from '../../../domain/common/text.normalizer';
import { IWatchlistItem } from '../../../domain/watchlist/interfaces/watchlist.interface';
import { IWatchlistRepositoryRead } from '../../../domain/watchlist/repository/watchlist.repository.read';
import { Mwatchlist } from '../../db/mongo/models/watchlist.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMWatchlistItem } from '../../db/mongo/schema/watchlist.schema';
import { toWatchlistItem } from './watchlist.mapper';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

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

    const item = await Mwatchlist.findOne(
      { userId: toObjectId(params.userId), $or: sameMovie },
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMWatchlistItem>();
    return item && toWatchlistItem(item);
  }

  async listWatchlistItems(
    userId: string,
    search: string | undefined,
    pagination: IPagination,
  ): Promise<IWatchlistItem[]> {
    if (!isObjectId(userId)) {
      return [];
    }
    const items = await Mwatchlist.find(
      this.buildFilter(userId, search),
      HIDE_MONGO_INTERNAL_FIELDS,
    )
      .sort({ addedAt: -1, _id: -1 })
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean<IMWatchlistItem[]>();
    return items.map(toWatchlistItem);
  }

  async countWatchlistItems(
    userId: string,
    search: string | undefined,
  ): Promise<number> {
    if (!isObjectId(userId)) {
      return 0;
    }
    return Mwatchlist.countDocuments(this.buildFilter(userId, search));
  }

  private buildFilter(
    userId: string,
    search: string | undefined,
  ): FilterQuery<IMWatchlistItem> {
    const filter: FilterQuery<IMWatchlistItem> = {
      userId: toObjectId(userId),
    };
    const normalizedSearch = search ? normalizeText(search) : '';
    if (normalizedSearch) {
      filter.normalizedTitle = {
        $regex: normalizedSearch.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'),
      };
    }
    return filter;
  }
}
