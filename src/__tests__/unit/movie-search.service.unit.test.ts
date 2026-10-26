import { Logger } from 'traceability';
import {
  ICatalogSearchPage,
  IMovieCatalogProvider,
} from '../../domain/common/providers/movie-catalog.provider';
import { IGenreRepositoryRead } from '../../domain/genre/repository/genre.repository.read';
import { MovieSearchService } from '../../domain/movie-search/service/movie-search.service';

const DRAMA = { _id: 'genre-drama', name: 'Drama', tmdbGenreId: 18 };
const CRIME = { _id: 'genre-crime', name: 'Crime', tmdbGenreId: 80 };

const A_CATALOG_PAGE: ICatalogSearchPage = {
  items: [
    {
      tmdbId: 598,
      title: 'Cidade de Deus',
      originalTitle: 'Cidade de Deus',
      synopsis: 'Buscapé cresce na Cidade de Deus.',
      releaseYear: 2002,
      posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
      tmdbGenreIds: [18, 80, 99999],
    },
    {
      tmdbId: 1,
      title: 'Outro',
      originalTitle: 'Other',
      tmdbGenreIds: [18],
    },
  ],
  total: 2,
  page: 1,
  limit: 20,
};

let movieCatalogProvider: jest.Mocked<IMovieCatalogProvider>;
let genreRepositoryRead: jest.Mocked<IGenreRepositoryRead>;
let movieSearchService: MovieSearchService;

beforeEach(() => {
  movieCatalogProvider = {
    searchMovies: jest.fn().mockResolvedValue(A_CATALOG_PAGE),
  };
  genreRepositoryRead = {
    listGenres: jest.fn(),
    findGenresByIds: jest.fn(),
    findGenresByTmdbIds: jest.fn().mockResolvedValue([DRAMA, CRIME]),
  };
  movieSearchService = new MovieSearchService({
    movieCatalogProvider,
    genreRepositoryRead,
  });
});

describe('When we search movies in the catalog', () => {
  it('should search with the trimmed query and keep the page metadata', async () => {
    const result = await movieSearchService.searchMovies({
      query: '  cidade de deus ',
      page: 2,
    });

    expect(movieCatalogProvider.searchMovies).toHaveBeenCalledWith({
      query: 'cidade de deus',
      page: 2,
    });
    expect(result).toMatchObject({ total: 2, page: 1, limit: 20 });
  });

  it('should translate the TMDB genres to our ids and drop the unknown ones', async () => {
    const result = await movieSearchService.searchMovies({
      query: 'cidade',
      page: 1,
    });

    expect(result.items).toEqual([
      {
        tmdbId: 598,
        title: 'Cidade de Deus',
        originalTitle: 'Cidade de Deus',
        synopsis: 'Buscapé cresce na Cidade de Deus.',
        releaseYear: 2002,
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        genreIds: ['genre-drama', 'genre-crime'],
      },
      {
        tmdbId: 1,
        title: 'Outro',
        originalTitle: 'Other',
        genreIds: ['genre-drama'],
      },
    ]);
  });

  it('should look the genres up once, without repeated ids', async () => {
    await movieSearchService.searchMovies({ query: 'cidade', page: 1 });

    expect(genreRepositoryRead.findGenresByTmdbIds).toHaveBeenCalledTimes(1);
    expect(genreRepositoryRead.findGenresByTmdbIds).toHaveBeenCalledWith([
      18, 80, 99999,
    ]);
  });
});

describe('When the catalog finds no movies', () => {
  it('should return an empty page without looking up genres', async () => {
    movieCatalogProvider.searchMovies.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const result = await movieSearchService.searchMovies({
      query: 'xyzxyz',
      page: 1,
    });

    expect(result.items).toEqual([]);
    expect(genreRepositoryRead.findGenresByTmdbIds).not.toHaveBeenCalled();
  });
});

describe('When the genre repository fails unexpectedly', () => {
  it('should log the error with the service context and rethrow it', async () => {
    genreRepositoryRead.findGenresByTmdbIds.mockRejectedValue(
      new Error('database down'),
    );
    const errorSpy = jest
      .spyOn(Logger, 'error')
      .mockImplementation(() => Logger);

    await expect(
      movieSearchService.searchMovies({ query: 'cidade', page: 1 }),
    ).rejects.toThrow('database down');
    expect(errorSpy).toHaveBeenCalledWith(
      'Unexpected error in MovieSearchService.searchMovies',
      expect.objectContaining({ eventName: 'service.unexpected_error' }),
    );
    errorSpy.mockRestore();
  });
});
