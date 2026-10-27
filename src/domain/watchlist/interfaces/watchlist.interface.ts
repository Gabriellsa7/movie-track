export enum EWatchlistPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum EWatchlistSortField {
  ADDED_AT = 'addedAt',
  PRIORITY = 'priority',
  PLANNED_FOR = 'plannedFor',
}

export interface IWatchlistItem {
  _id: string;
  userId: string;
  tmdbId?: number;
  title: string;
  normalizedTitle: string;
  posterUrl?: string;
  releaseYear?: number;
  priority: EWatchlistPriority;
  note?: string;
  synopsis?: string;
  genreIds?: string[];
  director?: string;
  durationMinutes?: number;
  // When the user plans to watch it ("next movies"); absent for "some day".
  plannedFor?: Date;
  addedAt: Date;
}

export interface IParamsWatchlistItem {
  _id?: string;
  userId: string;
  tmdbId?: number;
  title: string;
  posterUrl?: string;
  releaseYear?: number;
  priority?: EWatchlistPriority;
  note?: string;
  synopsis?: string;
  genreIds?: string[];
  director?: string;
  durationMinutes?: number;
  plannedFor?: Date;
  addedAt?: Date;
}

// null clears an optional field; an empty note clears it too.
export interface IWatchlistItemDetailsData {
  title?: string;
  releaseYear?: number | null;
  tmdbId?: number | null;
  posterUrl?: string | null;
  priority?: EWatchlistPriority;
  note?: string;
  synopsis?: string;
  genreIds?: string[] | null;
  director?: string;
  durationMinutes?: number | null;
  plannedFor?: Date | null;
}

export interface IWatchlistFilter {
  userId: string;
  search?: string;
  priority?: EWatchlistPriority;
  // true: only items with plannedFor ("next movies"); false: only items without it.
  planned?: boolean;
}

// priority is optional on write: a missing one reads as medium.
export type IWatchlistItemData = Omit<IWatchlistItem, '_id' | 'priority'> & {
  priority?: EWatchlistPriority;
};

export type IWatchlistItemResponse = Omit<
  IWatchlistItem,
  '_id' | 'normalizedTitle'
> & {
  id: string;
};
