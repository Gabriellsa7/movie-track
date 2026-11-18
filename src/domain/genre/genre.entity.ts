import { ELanguage } from '../common/language';
import {
  IGenre,
  IGenreData,
  IGenreResponse,
  IGenreTranslatedNames,
  IParamsGenre,
} from './interfaces/genre.interface';

export class Genre implements IGenreData {
  _id?: string;

  name: string;

  tmdbGenreId: number;

  translatedNames?: IGenreTranslatedNames;

  constructor(params: IParamsGenre) {
    this.name = params.name.trim();
    this.tmdbGenreId = params.tmdbGenreId;

    if (params._id) {
      this._id = params._id;
    }

    if (params.translatedNames) {
      this.translatedNames = params.translatedNames;
    }
  }

  public static nameIn(
    genre: Pick<IGenre, 'name' | 'translatedNames'>,
    language: ELanguage,
  ): string {
    return genre.translatedNames?.[language] ?? genre.name;
  }

  public static toGenreResponse(
    data: IGenre,
    language: ELanguage,
  ): IGenreResponse {
    return {
      id: data._id,
      name: Genre.nameIn(data, language),
    };
  }
}
