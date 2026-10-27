import { IPagination } from '../../common/pagination.interface';
import {
  EWatchlistSortField,
  IWatchlistFilter,
  IWatchlistItem,
} from '../interfaces/watchlist.interface';

export interface IWatchlistRepositoryRead {
  findWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null>;
  findDuplicateWatchlistItem(params: {
    userId: string;
    tmdbId?: number;
    normalizedTitle: string;
    releaseYear?: number;
    excludeId?: string;
  }): Promise<IWatchlistItem | null>;
  listWatchlistItems(
    filter: IWatchlistFilter,
    sort: EWatchlistSortField,
    pagination: IPagination,
  ): Promise<IWatchlistItem[]>;
  countWatchlistItems(filter: IWatchlistFilter): Promise<number>;
}
