import {
  IWatchlistItem,
  IWatchlistItemData,
} from '../../../domain/watchlist/interfaces/watchlist.interface';
import { IWatchlistRepositoryWrite } from '../../../domain/watchlist/repository/watchlist.repository.write';
import { Mwatchlist } from '../../db/mongo/models/watchlist.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMWatchlistItem } from '../../db/mongo/schema/watchlist.schema';
import { toWatchlistItem } from './watchlist.mapper';

export class WatchlistRepositoryWrite implements IWatchlistRepositoryWrite {
  async createWatchlistItem(
    itemData: IWatchlistItemData,
  ): Promise<IWatchlistItem> {
    const createdItem = await Mwatchlist.create({
      ...itemData,
      userId: toObjectId(itemData.userId),
    });
    return toWatchlistItem(createdItem.toObject());
  }

  async deleteWatchlistItemById(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem | null> {
    if (!isObjectId(id) || !isObjectId(userId)) {
      return null;
    }
    const item = await Mwatchlist.findOneAndDelete(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      { projection: HIDE_MONGO_INTERNAL_FIELDS },
    ).lean<IMWatchlistItem>();
    return item && toWatchlistItem(item);
  }

  async deleteWatchlistItemsByUserId(userId: string): Promise<void> {
    if (!isObjectId(userId)) {
      return;
    }
    await Mwatchlist.deleteMany({ userId: toObjectId(userId) });
  }
}
