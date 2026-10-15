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
  watchedAt: Date;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type IMovieEntryData = Omit<IMovieEntry, '_id'>;

export enum EMovieEntrySortField {
  WATCHED_AT = 'watchedAt',
  RATING = 'rating',
  TITLE = 'title',
  RELEASE_YEAR = 'releaseYear',
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
  totalMinutes: number;
}
