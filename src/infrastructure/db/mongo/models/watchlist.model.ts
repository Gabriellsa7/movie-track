import mongoose from 'mongoose';
import { IMWatchlistItem, watchlistSchema } from '../schema/watchlist.schema';

export const Mwatchlist = mongoose.model<IMWatchlistItem>(
  'watchlist',
  watchlistSchema,
);
