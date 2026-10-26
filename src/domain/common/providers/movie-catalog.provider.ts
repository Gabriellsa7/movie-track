export interface IParamsSearchCatalog {
  query: string;
  page: number;
}

export interface ICatalogMovie {
  tmdbId: number;
  title: string;
  originalTitle: string;
  synopsis?: string;
  releaseYear?: number;
  posterUrl?: string;
  tmdbGenreIds: number[];
}

export interface ICatalogSearchPage {
  items: ICatalogMovie[];
  total: number;
  page: number;
  limit: number;
}

export interface IMovieCatalogProvider {
  searchMovies(params: IParamsSearchCatalog): Promise<ICatalogSearchPage>;
}
