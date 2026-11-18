import { ELanguage } from '../../common/language';
import { IGenreRepositoryRead } from '../repository/genre.repository.read';
import { IGenreResponse } from './genre.interface';

export interface IParamsGenreService {
  genreRepositoryRead: IGenreRepositoryRead;
}

export interface IGenreService {
  listGenres(language: ELanguage): Promise<IGenreResponse[]>;
}
