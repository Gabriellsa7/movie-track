export interface IWatchlistItem {
  id: string;
  userId: string;
  tmdbId?: number;
  title: string;
  normalizedTitle: string;
  posterUrl?: string;
  releaseYear?: number;
  addedAt: Date;
}
