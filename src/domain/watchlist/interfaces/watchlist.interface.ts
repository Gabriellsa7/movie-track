export interface IWatchlistItem {
  _id: string;
  userId: string;
  tmdbId?: number;
  title: string;
  normalizedTitle: string;
  posterUrl?: string;
  releaseYear?: number;
  addedAt: Date;
}

export interface IParamsWatchlistItem {
  _id?: string;
  userId: string;
  tmdbId?: number;
  title: string;
  posterUrl?: string;
  releaseYear?: number;
  addedAt?: Date;
}

export type IWatchlistItemData = Omit<IWatchlistItem, '_id'>;

export type IWatchlistItemResponse = Omit<
  IWatchlistItem,
  '_id' | 'normalizedTitle'
> & {
  id: string;
};
