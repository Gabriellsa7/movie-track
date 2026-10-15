import { IGenre } from '../interfaces/genre.interface';

export interface IGenreRepositoryRead {
  listGenres(): Promise<IGenre[]>;
  findGenresByIds(ids: string[]): Promise<IGenre[]>;
  findGenresByTmdbIds(tmdbGenreIds: number[]): Promise<IGenre[]>;
}
