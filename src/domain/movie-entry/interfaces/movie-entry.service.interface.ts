import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { IWatchlistRepositoryRead } from '../../watchlist/repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../../watchlist/repository/watchlist.repository.write';
import { IMovieEntryRepositoryRead } from '../repository/movie-entry.repository.read';
import { IMovieEntryRepositoryWrite } from '../repository/movie-entry.repository.write';
import {
  IMovieEntry,
  IMovieEntryFilter,
  IMovieEntrySort,
  IUserStats,
} from './movie-entry.interface';

export interface IParamsCreateMovieEntry {
  userId: string;
  title: string;
  synopsis: string;
  releaseYear: number;
  genreIds: string[];
  rating: number;
  review?: string;
  posterUrl?: string;
  director?: string;
  durationMinutes?: number;
  watchedAt?: Date;
  isFavorite?: boolean;
  tmdbId?: number;
  watchlistItemId?: string;
}

export interface IParamsUpdateMovieEntry {
  id: string;
  userId: string;
  movieData: Omit<
    IParamsCreateMovieEntry,
    'userId' | 'watchlistItemId' | 'posterUrl'
  > & {
    posterUrl?: string | null;
  };
}

export interface IParamsSetFavorite {
  id: string;
  userId: string;
  isFavorite: boolean;
}

export interface IParamsUploadPoster {
  id: string;
  userId: string;
  buffer: Buffer;
  mimeType: string;
}

export interface IParamsListMovieEntries {
  filter: IMovieEntryFilter;
  sort: IMovieEntrySort;
  pagination: IPagination;
}

export interface IParamsMovieEntryService {
  movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  movieEntryRepositoryWrite: IMovieEntryRepositoryWrite;
  genreRepositoryRead: IGenreRepositoryRead;
  watchlistRepositoryRead: IWatchlistRepositoryRead;
  watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  userRepositoryRead: IUserRepositoryRead;
  storageProvider: IStorageProvider;
  clock: IClock;
}

export interface IMovieEntryService {
  createMovieEntry(params: IParamsCreateMovieEntry): Promise<IMovieEntry>;
  getMovieEntryById(id: string, userId: string): Promise<IMovieEntry>;
  listMovieEntries(
    params: IParamsListMovieEntries,
  ): Promise<IPaginatedResult<IMovieEntry>>;
  updateMovieEntry(params: IParamsUpdateMovieEntry): Promise<IMovieEntry>;
  setFavorite(params: IParamsSetFavorite): Promise<IMovieEntry>;
  deleteMovieEntry(id: string, userId: string): Promise<void>;
  uploadPoster(params: IParamsUploadPoster): Promise<IMovieEntry>;
  removePoster(id: string, userId: string): Promise<IMovieEntry>;
  getUserStats(userId: string): Promise<IUserStats>;
}
