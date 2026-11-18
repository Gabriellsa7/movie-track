import { ELanguage } from '../language';

export interface IParamsSearchCatalog {
  query: string;
  page: number;
  language: ELanguage;
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

// What the search results lack: TMDB only returns them movie by movie.
export interface ICatalogMovieDetails {
  tmdbId: number;
  director?: string;
  durationMinutes?: number;
}

export interface IMovieCatalogProvider {
  searchMovies(params: IParamsSearchCatalog): Promise<ICatalogSearchPage>;
  // null when TMDB has no movie with this id.
  getMovieDetails(
    tmdbId: number,
    language: ELanguage,
  ): Promise<ICatalogMovieDetails | null>;
}
