import { IGenreRepositoryRead } from '../repository/genre.repository.read';
import { IGenreResponse } from './genre.interface';

export interface IParamsGenreService {
  genreRepositoryRead: IGenreRepositoryRead;
}

export interface IGenreService {
  listGenres(): Promise<IGenreResponse[]>;
}
