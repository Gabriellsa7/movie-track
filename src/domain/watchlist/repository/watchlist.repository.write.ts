import {
  IWatchlistItem,
  IWatchlistItemData,
} from '../interfaces/watchlist.interface';

export interface IWatchlistRepositoryWrite {
  createWatchlistItem(itemData: IWatchlistItemData): Promise<IWatchlistItem>;
  updateWatchlistItemById(
    id: string,
    userId: string,
    itemData: Partial<Omit<IWatchlistItemData, 'userId'>>,
  ): Promise<IWatchlistItem | null>;
  deleteWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null>;
  deleteWatchlistItemsByUserId(userId: string): Promise<void>;
}
