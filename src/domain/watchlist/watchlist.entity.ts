import { normalizeText } from '../common/text.normalizer';
import {
  IParamsWatchlistItem,
  IWatchlistItem,
  IWatchlistItemData,
  IWatchlistItemResponse,
} from './interfaces/watchlist.interface';

export class WatchlistItem implements IWatchlistItemData {
  _id?: string;

  userId: string;

  tmdbId?: number;

  title: string;

  normalizedTitle: string;

  posterUrl?: string;

  releaseYear?: number;

  addedAt: Date;

  constructor(params: IParamsWatchlistItem) {
    this.userId = params.userId;
    this.title = params.title.trim();
    this.normalizedTitle = normalizeText(params.title);
    this.addedAt = params.addedAt ?? new Date();

    if (params._id) {
      this._id = params._id;
    }

    if (params.tmdbId !== undefined) {
      this.tmdbId = params.tmdbId;
    }

    if (params.posterUrl) {
      this.posterUrl = params.posterUrl;
    }

    if (params.releaseYear !== undefined) {
      this.releaseYear = params.releaseYear;
    }
  }

  public static toWatchlistItemResponse(
    data: IWatchlistItem,
  ): IWatchlistItemResponse {
    const { _id, normalizedTitle, ...item } = data;

    return { id: _id, ...item };
  }
}
