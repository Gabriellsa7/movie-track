import { ELanguage } from '../../common/language';

// name is the English one; translatedNames holds the other languages the app supports.
export type IGenreTranslatedNames = Partial<Record<ELanguage, string>>;

export interface IGenre {
  _id: string;
  name: string;
  tmdbGenreId: number;
  translatedNames?: IGenreTranslatedNames;
}

export interface IParamsGenre {
  _id?: string;
  name: string;
  tmdbGenreId: number;
  translatedNames?: IGenreTranslatedNames;
}

export type IGenreData = Omit<IGenre, '_id'>;

export interface IGenreResponse {
  id: string;
  name: string;
}
