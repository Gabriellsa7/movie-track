import {
  IGenre,
  IGenreData,
  IGenreResponse,
  IParamsGenre,
} from './interfaces/genre.interface';

export class Genre implements IGenreData {
  _id?: string;

  name: string;

  tmdbGenreId: number;

  constructor(params: IParamsGenre) {
    this.name = params.name.trim();
    this.tmdbGenreId = params.tmdbGenreId;

    if (params._id) {
      this._id = params._id;
    }
  }

  public static toGenreResponse(data: IGenre): IGenreResponse {
    return {
      id: data._id,
      name: data.name,
    };
  }
}
