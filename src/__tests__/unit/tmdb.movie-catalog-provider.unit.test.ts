import { Logger } from 'traceability';
import { ServiceUnavailableError } from '../../domain/errors/service-unavailable.error';
import { TmdbMovieCatalogProvider } from '../../infrastructure/providers/movie-catalog/tmdb.movie-catalog-provider';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const A_TMDB_PAGE = {
  page: 1,
  total_results: 3,
  results: [
    {
      id: 598,
      title: 'Cidade de Deus',
      original_title: 'Cidade de Deus',
      overview: ' Buscapé cresce na Cidade de Deus. ',
      release_date: '2002-08-30',
      poster_path: '/poster.jpg',
      genre_ids: [18, 80],
    },
    {
      id: 2,
      title: 'Sem dados',
      original_title: 'No data',
      overview: '',
      release_date: '',
      poster_path: null,
      genre_ids: [],
    },
    { id: 3, title: 'Mínimo', original_title: 'Minimal' },
  ],
};

let fetchMock: jest.Mock;
let provider: TmdbMovieCatalogProvider;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue(jsonResponse(A_TMDB_PAGE));
  provider = new TmdbMovieCatalogProvider({
    accessToken: 'tmdb-token',
    fetch: fetchMock,
  });
  warnSpy = jest.spyOn(Logger, 'warn').mockImplementation(() => Logger);
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('When we search movies in TMDB', () => {
  it('should call the search endpoint in pt-BR with the bearer token', async () => {
    await provider.searchMovies({ query: 'cidade de deus', page: 2 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url.origin + url.pathname).toBe(
      'https://api.themoviedb.org/3/search/movie',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: 'cidade de deus',
      page: '2',
      language: 'pt-BR',
      include_adult: 'false',
    });
    expect(init.headers.Authorization).toBe('Bearer tmdb-token');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('should map the results and the page metadata', async () => {
    const result = await provider.searchMovies({ query: 'cidade', page: 1 });

    expect(result).toEqual({
      items: [
        {
          tmdbId: 598,
          title: 'Cidade de Deus',
          originalTitle: 'Cidade de Deus',
          synopsis: 'Buscapé cresce na Cidade de Deus.',
          releaseYear: 2002,
          posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          tmdbGenreIds: [18, 80],
        },
        {
          tmdbId: 2,
          title: 'Sem dados',
          originalTitle: 'No data',
          tmdbGenreIds: [],
        },
        {
          tmdbId: 3,
          title: 'Mínimo',
          originalTitle: 'Minimal',
          tmdbGenreIds: [],
        },
      ],
      total: 3,
      page: 1,
      limit: 20,
    });
  });
});

describe('When TMDB answers with an error status', () => {
  it('should throw 503 MOVIE_CATALOG_UNAVAILABLE and log the upstream status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status_message: 'Invalid API key' }, 401),
    );

    const search = provider.searchMovies({ query: 'cidade', page: 1 });

    await expect(search).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(search).rejects.toMatchObject({
      status: 503,
      code: 'MOVIE_CATALOG_UNAVAILABLE',
    });
    expect(warnSpy).toHaveBeenCalledWith('TMDB request failed', {
      eventName: 'tmdb.request_failed',
      upstreamStatus: 401,
    });
  });
});

describe('When TMDB cannot be reached', () => {
  it('should throw 503 MOVIE_CATALOG_UNAVAILABLE and log the cause', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    await expect(
      provider.searchMovies({ query: 'cidade', page: 1 }),
    ).rejects.toMatchObject({ status: 503, code: 'MOVIE_CATALOG_UNAVAILABLE' });
    expect(warnSpy).toHaveBeenCalledWith('TMDB request failed', {
      eventName: 'tmdb.request_failed',
      error: 'The operation was aborted',
    });
  });
});
