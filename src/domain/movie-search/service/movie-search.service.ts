import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IPaginatedResult } from '../../common/pagination.interface';
import {
  ICatalogMovie,
  IMovieCatalogProvider,
} from '../../common/providers/movie-catalog.provider';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { IMovieSearchResult } from '../interfaces/movie-search.interface';
import {
  IMovieSearchService,
  IParamsMovieSearchService,
  IParamsSearchMovies,
} from '../interfaces/movie-search.service.interface';

export class MovieSearchService implements IMovieSearchService {
  private movieCatalogProvider: IMovieCatalogProvider;
  private genreRepositoryRead: IGenreRepositoryRead;

  constructor({
    movieCatalogProvider,
    genreRepositoryRead,
  }: IParamsMovieSearchService) {
    this.movieCatalogProvider = movieCatalogProvider;
    this.genreRepositoryRead = genreRepositoryRead;
  }

  @ErrorHandler()
  async searchMovies(
    params: IParamsSearchMovies,
  ): Promise<IPaginatedResult<IMovieSearchResult>> {
    const catalogPage = await this.movieCatalogProvider.searchMovies({
      query: params.query.trim(),
      page: params.page,
    });

    // Movies reference our genre ids, so the TMDB ones are translated; unknown ones are dropped.
    const tmdbGenreIds = [
      ...new Set(catalogPage.items.flatMap((movie) => movie.tmdbGenreIds)),
    ];
    const genres =
      tmdbGenreIds.length > 0
        ? await this.genreRepositoryRead.findGenresByTmdbIds(tmdbGenreIds)
        : [];
    const genreIdByTmdbId = new Map(
      genres.map((genre) => [genre.tmdbGenreId, genre._id]),
    );

    return {
      ...catalogPage,
      items: catalogPage.items.map((movie) =>
        this.toSearchResult(movie, genreIdByTmdbId),
      ),
    };
  }

  private toSearchResult(
    movie: ICatalogMovie,
    genreIdByTmdbId: Map<number, string>,
  ): IMovieSearchResult {
    const { tmdbGenreIds, ...result } = movie;
    return {
      ...result,
      genreIds: tmdbGenreIds
        .map((tmdbGenreId) => genreIdByTmdbId.get(tmdbGenreId))
        .filter((genreId): genreId is string => genreId !== undefined),
    };
  }
}
