import { IClock } from '../../common/providers/clock.provider';
import {
  IPaginatedResult,
  IPagination,
} from '../../common/pagination.interface';
import { IMovieEntryRepositoryRead } from '../../movie-entry/repository/movie-entry.repository.read';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IWatchlistRepositoryRead } from '../repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../repository/watchlist.repository.write';
import { IWatchlistItem } from './watchlist.interface';

export interface IParamsAddWatchlistItem {
  userId: string;
  title: string;
  tmdbId?: number;
  posterUrl?: string;
  releaseYear?: number;
}

export interface IParamsListWatchlistItems {
  userId: string;
  search?: string;
  pagination: IPagination;
}

export interface IParamsWatchlistService {
  watchlistRepositoryRead: IWatchlistRepositoryRead;
  watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  userRepositoryRead: IUserRepositoryRead;
  clock: IClock;
}

export interface IWatchlistService {
  addWatchlistItem(params: IParamsAddWatchlistItem): Promise<IWatchlistItem>;
  listWatchlistItems(
    params: IParamsListWatchlistItems,
  ): Promise<IPaginatedResult<IWatchlistItem>>;
  removeWatchlistItem(id: string, userId: string): Promise<void>;
}
