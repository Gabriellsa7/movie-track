import { UpdateQuery } from 'mongoose';
import {
  EWatchlistPriority,
  IWatchlistItem,
  IWatchlistItemData,
} from '../../../domain/watchlist/interfaces/watchlist.interface';
import { IMWatchlistItem } from '../../db/mongo/schema/watchlist.schema';

export function toWatchlistItem(document: IMWatchlistItem): IWatchlistItem {
  return {
    ...document,
    _id: document._id.toString(),
    userId: document.userId.toString(),
    priority: document.priority ?? EWatchlistPriority.MEDIUM,
  };
}

// Mongoose drops undefined keys from updates, so clearing an optional field
// (e.g. removing the note) has to become an explicit $unset.
export function toWatchlistItemUpdate(
  itemData: Partial<Omit<IWatchlistItemData, 'userId'>>,
): UpdateQuery<IMWatchlistItem> {
  const $set: Partial<IMWatchlistItem> = {};
  const $unset: Record<string, ''> = {};

  for (const [field, value] of Object.entries(itemData)) {
    if (value === undefined) {
      $unset[field] = '';
    } else {
      Object.assign($set, { [field]: value });
    }
  }

  return Object.keys($unset).length ? { $set, $unset } : { $set };
}
