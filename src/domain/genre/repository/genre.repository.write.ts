import { IGenreData } from '../interfaces/genre.interface';

export interface IGenreRepositoryWrite {
  upsertGenres(genres: IGenreData[]): Promise<void>;
}
