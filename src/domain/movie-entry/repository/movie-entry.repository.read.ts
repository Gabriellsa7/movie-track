import { IPagination } from '../../common/pagination.interface';
import {
  IMovieEntry,
  IMovieEntryFilter,
  IMovieEntrySort,
  IUserStats,
} from '../interfaces/movie-entry.interface';

export interface IMovieEntryRepositoryRead {
  findMovieEntryById(id: string, userId: string): Promise<IMovieEntry | null>;
  findDuplicateMovieEntry(params: {
    userId: string;
    tmdbId?: number;
    normalizedTitle: string;
    releaseYear: number;
    excludeId?: string;
  }): Promise<IMovieEntry | null>;
  listMovieEntries(
    filter: IMovieEntryFilter,
    sort: IMovieEntrySort,
    pagination: IPagination,
  ): Promise<IMovieEntry[]>;
  countMovieEntries(filter: IMovieEntryFilter): Promise<number>;
  getUserStats(userId: string, since: Date): Promise<IUserStats>;
  getSummariesByUserIds(userIds: string[]): Promise<
    {
      userId: string;
      moviesCount: number;
      averageRating: number | null;
      favoritesCount: number;
    }[]
  >;
}
