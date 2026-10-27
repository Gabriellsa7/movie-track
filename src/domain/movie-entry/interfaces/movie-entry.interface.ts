export interface IMovieEntry {
  _id: string;
  userId: string;
  tmdbId?: number;
  title: string;
  normalizedTitle: string;
  synopsis: string;
  posterUrl?: string;
  posterPublicId?: string;
  releaseYear: number;
  genreIds: string[];
  director?: string;
  durationMinutes?: number;
  rating: number;
  review?: string;
  // The last time it was watched; watchCount counts every time.
  watchedAt: Date;
  watchCount: number;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IParamsMovieEntry {
  _id?: string;
  userId: string;
  tmdbId?: number;
  title: string;
  synopsis: string;
  posterUrl?: string;
  posterPublicId?: string;
  releaseYear: number;
  genreIds: string[];
  director?: string;
  durationMinutes?: number;
  rating: number;
  review?: string;
  watchedAt?: Date;
  watchCount?: number;
  isFavorite?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IMovieEntryDetailsData = Partial<
  Pick<
    IMovieEntry,
    | 'tmdbId'
    | 'title'
    | 'synopsis'
    | 'releaseYear'
    | 'genreIds'
    | 'director'
    | 'durationMinutes'
    | 'rating'
    | 'review'
    | 'watchedAt'
    | 'watchCount'
    | 'isFavorite'
  >
>;

export type IMovieEntryData = Omit<IMovieEntry, '_id'>;

export type IMovieEntryResponse = Omit<
  IMovieEntry,
  '_id' | 'normalizedTitle' | 'posterPublicId'
> & {
  id: string;
};

export enum EMovieEntrySortField {
  WATCHED_AT = 'watchedAt',
  RATING = 'rating',
  TITLE = 'title',
  RELEASE_YEAR = 'releaseYear',
  WATCH_COUNT = 'watchCount',
}

export enum ESortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export interface IMovieEntryFilter {
  userId: string;
  search?: string;
  genreId?: string;
  minRating?: number;
  maxRating?: number;
  favorite?: boolean;
}

export interface IMovieEntrySort {
  field: EMovieEntrySortField;
  order: ESortOrder;
}

export interface IUserStats {
  totalMovies: number;
  averageRating: number | null;
  favoritesCount: number;
  ratingDistribution: { rating: number; count: number }[];
  moviesPerMonth: { month: string; count: number }[];
  topGenres: { genreId: string; name: string; count: number }[];
  totalWatches: number;
  totalMinutes: number;
}
