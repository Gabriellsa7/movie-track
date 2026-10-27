import mongoose, { Types } from 'mongoose';
import {
  EWatchlistPriority,
  IWatchlistItem,
} from '../../../../domain/watchlist/interfaces/watchlist.interface';

export interface IMWatchlistItem
  extends Omit<IWatchlistItem, '_id' | 'userId' | 'genreIds'> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  genreIds?: Types.ObjectId[];
}

export const watchlistSchema = new mongoose.Schema<IMWatchlistItem>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tmdbId: {
      type: Number,
    },
    title: {
      type: String,
      required: true,
    },
    normalizedTitle: {
      type: String,
      required: true,
    },
    posterUrl: {
      type: String,
    },
    releaseYear: {
      type: Number,
    },
    // Not required: items saved before priorities existed read as medium.
    priority: {
      type: String,
      enum: Object.values(EWatchlistPriority),
    },
    note: {
      type: String,
    },
    synopsis: {
      type: String,
    },
    genreIds: {
      type: [mongoose.Schema.Types.ObjectId],
      default: undefined,
    },
    director: {
      type: String,
    },
    durationMinutes: {
      type: Number,
    },
    plannedFor: {
      type: Date,
    },
    addedAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false },
);

watchlistSchema.index({ userId: 1, addedAt: -1, _id: -1 });
watchlistSchema.index({ userId: 1, normalizedTitle: 1, releaseYear: 1 });
watchlistSchema.index({ userId: 1, tmdbId: 1 });
watchlistSchema.index({ userId: 1, plannedFor: 1 });
