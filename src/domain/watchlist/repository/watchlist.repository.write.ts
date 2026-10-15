import { IWatchlistItem } from '../interfaces/watchlist.interface';

export interface IWatchlistRepositoryWrite {
  createWatchlistItem(itemData: IWatchlistItem): Promise<IWatchlistItem>;
  deleteWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null>;
  deleteWatchlistItemsByUserId(userId: string): Promise<void>;
}
