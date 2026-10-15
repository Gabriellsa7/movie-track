import {
  IWatchlistItem,
  IWatchlistItemData,
} from '../interfaces/watchlist.interface';

export interface IWatchlistRepositoryWrite {
  createWatchlistItem(itemData: IWatchlistItemData): Promise<IWatchlistItem>;
  deleteWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null>;
  deleteWatchlistItemsByUserId(userId: string): Promise<void>;
}
