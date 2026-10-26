import { Logger } from 'traceability';
import {
  ICatalogMovie,
  ICatalogSearchPage,
  IMovieCatalogProvider,
  IParamsSearchCatalog,
} from '../../../domain/common/providers/movie-catalog.provider';
import { ServiceUnavailableError } from '../../../domain/errors/service-unavailable.error';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_POSTER_URL = 'https://image.tmdb.org/t/p/w500';
// Genres are seeded in pt-BR, so titles and synopses come in the same language.
const TMDB_LANGUAGE = 'pt-BR';
const TMDB_PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MILLISECONDS = 5000;

interface ITmdbMovie {
  id: number;
  title: string;
  original_title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  genre_ids?: number[];
}

interface ITmdbSearchResponse {
  page: number;
  results: ITmdbMovie[];
  total_results: number;
}

export interface IParamsTmdbMovieCatalogProvider {
  accessToken: string;
  fetch?: typeof fetch;
}

export class TmdbMovieCatalogProvider implements IMovieCatalogProvider {
  private readonly accessToken: string;
  private readonly fetch: typeof fetch;

  constructor({ accessToken, fetch: fetchFn }: IParamsTmdbMovieCatalogProvider) {
    this.accessToken = accessToken;
    this.fetch = fetchFn ?? fetch;
  }

  async searchMovies({
    query,
    page,
  }: IParamsSearchCatalog): Promise<ICatalogSearchPage> {
    const url = new URL(`${TMDB_API_URL}/search/movie`);
    url.searchParams.set('query', query);
    url.searchParams.set('page', String(page));
    url.searchParams.set('language', TMDB_LANGUAGE);
    url.searchParams.set('include_adult', 'false');

    const body = await this.request<ITmdbSearchResponse>(url);
    return {
      items: body.results.map((movie) => this.toCatalogMovie(movie)),
      total: body.total_results,
      page: body.page,
      limit: TMDB_PAGE_SIZE,
    };
  }

  private async request<T>(url: URL): Promise<T> {
    let response: Response;
    try {
      response = await this.fetch(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS),
      });
    } catch (error) {
      throw this.unavailableError({
        error: error instanceof Error ? error.message : String(error),
      });
    }
    if (!response.ok) {
      throw this.unavailableError({ upstreamStatus: response.status });
    }
    return (await response.json()) as T;
  }

  // The client only learns that the catalog is down; the reason goes to the log.
  private unavailableError(
    details: Record<string, unknown>,
  ): ServiceUnavailableError {
    Logger.warn('TMDB request failed', {
      eventName: 'tmdb.request_failed',
      ...details,
    });
    return new ServiceUnavailableError(
      'Movie catalog unavailable',
      'MOVIE_CATALOG_UNAVAILABLE',
    );
  }

  private toCatalogMovie(movie: ITmdbMovie): ICatalogMovie {
    const releaseYear = Number.parseInt(movie.release_date ?? '', 10);
    return {
      tmdbId: movie.id,
      title: movie.title,
      originalTitle: movie.original_title,
      tmdbGenreIds: movie.genre_ids ?? [],
      ...(movie.overview?.trim() && { synopsis: movie.overview.trim() }),
      ...(Number.isInteger(releaseYear) && { releaseYear }),
      ...(movie.poster_path && {
        posterUrl: `${TMDB_POSTER_URL}${movie.poster_path}`,
      }),
    };
  }
}
