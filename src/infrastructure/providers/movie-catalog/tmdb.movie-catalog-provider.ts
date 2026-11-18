import { Logger } from 'traceability';
import {
  ICatalogMovie,
  ICatalogMovieDetails,
  ICatalogSearchPage,
  IMovieCatalogProvider,
  IParamsSearchCatalog,
} from '../../../domain/common/providers/movie-catalog.provider';
import { ServiceUnavailableError } from '../../../domain/errors/service-unavailable.error';

const TMDB_API_URL = 'https://api.themoviedb.org/3';
const TMDB_POSTER_URL = 'https://image.tmdb.org/t/p/w500';
// Genres are seeded in English, so titles and synopses come in the same language.
const TMDB_LANGUAGE = 'en-US';
const TMDB_PAGE_SIZE = 20;
const REQUEST_TIMEOUT_MILLISECONDS = 5000;
const NOT_FOUND_STATUS = 404;
const DIRECTOR_JOB = 'Director';
const DIRECTOR_MAX_LENGTH = 200;
const MAX_DURATION_MINUTES = 1000;

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

interface ITmdbMovieDetails {
  id: number;
  runtime?: number | null;
  credits?: { crew?: { job?: string; name?: string }[] };
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

  async getMovieDetails(tmdbId: number): Promise<ICatalogMovieDetails | null> {
    const url = new URL(`${TMDB_API_URL}/movie/${tmdbId}`);
    url.searchParams.set('language', TMDB_LANGUAGE);
    url.searchParams.set('append_to_response', 'credits');

    const body = await this.request<ITmdbMovieDetails | null>(url, {
      notFoundAsNull: true,
    });
    return body && this.toCatalogMovieDetails(body);
  }

  private async request<T>(
    url: URL,
    { notFoundAsNull = false }: { notFoundAsNull?: boolean } = {},
  ): Promise<T> {
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
    if (notFoundAsNull && response.status === NOT_FOUND_STATUS) {
      return null as T;
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

  // Values our movies would reject (no runtime, or a list of directors over the limit) are left out.
  private toCatalogMovieDetails(movie: ITmdbMovieDetails): ICatalogMovieDetails {
    const directors = [
      ...new Set(
        (movie.credits?.crew ?? [])
          .filter((member) => member.job === DIRECTOR_JOB && member.name)
          .map((member) => member.name!.trim()),
      ),
    ].join(', ');
    const { runtime } = movie;
    return {
      tmdbId: movie.id,
      ...(directors &&
        directors.length <= DIRECTOR_MAX_LENGTH && { director: directors }),
      ...(runtime &&
        runtime > 0 &&
        runtime <= MAX_DURATION_MINUTES && { durationMinutes: runtime }),
    };
  }
}
