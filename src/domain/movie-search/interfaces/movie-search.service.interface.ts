import { IPaginatedResult } from '../../common/pagination.interface';
import { IMovieCatalogProvider } from '../../common/providers/movie-catalog.provider';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { IMovieSearchResult } from './movie-search.interface';

export interface IParamsSearchMovies {
  query: string;
  page: number;
}

export interface IParamsMovieSearchService {
  movieCatalogProvider: IMovieCatalogProvider;
  genreRepositoryRead: IGenreRepositoryRead;
}

export interface IMovieSearchService {
  searchMovies(
    params: IParamsSearchMovies,
  ): Promise<IPaginatedResult<IMovieSearchResult>>;
}
