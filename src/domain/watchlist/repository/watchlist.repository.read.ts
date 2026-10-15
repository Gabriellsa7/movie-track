import { IPagination } from '../../common/pagination.interface';
import { IWatchlistItem } from '../interfaces/watchlist.interface';

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
  }): Promise<IWatchlistItem | null>;
  listWatchlistItems(
    userId: string,
    search: string | undefined,
    pagination: IPagination,
  ): Promise<IWatchlistItem[]>;
  countWatchlistItems(
    userId: string,
    search: string | undefined,
  ): Promise<number>;
}
