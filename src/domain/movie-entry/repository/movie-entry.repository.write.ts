import { IMovieEntry } from '../interfaces/movie-entry.interface';

export interface IMovieEntryRepositoryWrite {
  createMovieEntry(movieData: IMovieEntry): Promise<IMovieEntry>;
  updateMovieEntryById(
    id: string,
    userId: string,
    movieData: Partial<IMovieEntry>,
  ): Promise<IMovieEntry | null>;
  deleteMovieEntryById(id: string, userId: string): Promise<IMovieEntry | null>;
  deleteMovieEntriesByUserId(userId: string): Promise<IMovieEntry[]>;
}
