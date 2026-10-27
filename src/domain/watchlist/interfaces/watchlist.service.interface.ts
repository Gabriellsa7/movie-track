import { IClock } from '../../common/providers/clock.provider';
import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { IMovieEntryRepositoryRead } from '../../movie-entry/repository/movie-entry.repository.read';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IWatchlistRepositoryRead } from '../repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../repository/watchlist.repository.write';
import {
  EWatchlistPriority,
  EWatchlistSortField,
  IWatchlistFilter,
  IWatchlistItem,
  IWatchlistItemDetailsData,
} from './watchlist.interface';

export interface IParamsAddWatchlistItem {
  userId: string;
  title: string;
  tmdbId?: number;
  posterUrl?: string;
  releaseYear?: number;
  priority?: EWatchlistPriority;
  note?: string;
  synopsis?: string;
  genreIds?: string[];
  director?: string;
  durationMinutes?: number;
  plannedFor?: Date;
}

export interface IParamsUpdateWatchlistItem {
  id: string;
  userId: string;
  itemData: IWatchlistItemDetailsData;
}

export interface IParamsListWatchlistItems {
  filter: IWatchlistFilter;
  sort: EWatchlistSortField;
  pagination: IPagination;
}

export interface IParamsWatchlistService {
  watchlistRepositoryRead: IWatchlistRepositoryRead;
  watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  userRepositoryRead: IUserRepositoryRead;
  genreRepositoryRead: IGenreRepositoryRead;
  clock: IClock;
}

export interface IWatchlistService {
  addWatchlistItem(params: IParamsAddWatchlistItem): Promise<IWatchlistItem>;
  listWatchlistItems(
    params: IParamsListWatchlistItems,
  ): Promise<IPaginatedResult<IWatchlistItem>>;
  updateWatchlistItem(
    params: IParamsUpdateWatchlistItem,
  ): Promise<IWatchlistItem>;
  removeWatchlistItem(id: string, userId: string): Promise<void>;
}
