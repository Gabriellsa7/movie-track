import { normalizeText } from '../common/text.normalizer';
import {
  EWatchlistPriority,
  IParamsWatchlistItem,
  IWatchlistItemDetailsData,
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

  priority: EWatchlistPriority;

  note?: string;

  addedAt: Date;

  constructor(params: IParamsWatchlistItem) {
    this.userId = params.userId;
    this.title = params.title.trim();
    this.normalizedTitle = normalizeText(params.title);
    this.addedAt = params.addedAt ?? new Date();
    // Items saved before priorities existed read as medium.
    this.priority = params.priority ?? EWatchlistPriority.MEDIUM;

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

    if (params.note?.trim()) {
      this.note = params.note.trim();
    }
  }

  updateDetails(detailsData: IWatchlistItemDetailsData): void {
    if (detailsData.title !== undefined) {
      this.title = detailsData.title.trim();
      this.normalizedTitle = normalizeText(detailsData.title);
    }

    if (detailsData.releaseYear !== undefined) {
      this.releaseYear = detailsData.releaseYear ?? undefined;
    }

    if (detailsData.tmdbId !== undefined) {
      this.tmdbId = detailsData.tmdbId ?? undefined;
    }

    if (detailsData.posterUrl !== undefined) {
      this.posterUrl = detailsData.posterUrl ?? undefined;
    }

    if (detailsData.priority !== undefined) {
      this.priority = detailsData.priority;
    }

    if (detailsData.note !== undefined) {
      this.note = detailsData.note.trim() || undefined;
    }
  }

  public static toWatchlistItemResponse(
    data: IWatchlistItem,
  ): IWatchlistItemResponse {
    const { _id, normalizedTitle, ...item } = data;

    return { id: _id, ...item };
  }
}
