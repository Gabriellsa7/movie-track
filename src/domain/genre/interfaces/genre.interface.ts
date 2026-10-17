export interface IGenre {
  _id: string;
  name: string;
  tmdbGenreId: number;
}

export interface IParamsGenre {
  _id?: string;
  name: string;
  tmdbGenreId: number;
}

export type IGenreData = Omit<IGenre, '_id'>;

export interface IGenreResponse {
  id: string;
  name: string;
}
