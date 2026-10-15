import {
  IMovieEntry,
  IMovieEntryData,
} from '../interfaces/movie-entry.interface';

export interface IMovieEntryRepositoryWrite {
  createMovieEntry(movieData: IMovieEntryData): Promise<IMovieEntry>;
  updateMovieEntryById(
    id: string,
    userId: string,
    movieData: Partial<IMovieEntryData>,
  ): Promise<IMovieEntry | null>;
  deleteMovieEntryById(id: string, userId: string): Promise<IMovieEntry | null>;
  deleteMovieEntriesByUserId(userId: string): Promise<IMovieEntry[]>;
}
