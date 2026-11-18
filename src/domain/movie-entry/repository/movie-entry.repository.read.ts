import { ELanguage } from '../../common/language';
import { IPagination } from '../../common/pagination.interface';
import { IUserMoviesSummary } from '../../user/interfaces/user.interface';
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
    // Without a year only tmdbId can match: the same title may be a remake.
    releaseYear?: number;
    excludeId?: string;
  }): Promise<IMovieEntry | null>;
  listMovieEntries(
    filter: IMovieEntryFilter,
    sort: IMovieEntrySort,
    pagination: IPagination,
  ): Promise<IMovieEntry[]>;
  countMovieEntries(filter: IMovieEntryFilter): Promise<number>;
  getUserStats(
    userId: string,
    since: Date,
    language: ELanguage,
  ): Promise<IUserStats>;
  findUserIdsWithMovies(): Promise<string[]>;
  getSummariesByUserIds(
    userIds: string[],
  ): Promise<(IUserMoviesSummary & { userId: string })[]>;
}
