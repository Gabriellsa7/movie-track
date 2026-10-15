import { IWatchlistItem } from '../../../domain/watchlist/interfaces/watchlist.interface';
import { IMWatchlistItem } from '../../db/mongo/schema/watchlist.schema';

export function toWatchlistItem(document: IMWatchlistItem): IWatchlistItem {
  return {
    ...document,
    _id: document._id.toString(),
    userId: document.userId.toString(),
  };
}
