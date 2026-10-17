import { Logger } from 'traceability';
import { GenreService } from '../../domain/genre/service/genre.service';
import { IGenreRepositoryRead } from '../../domain/genre/repository/genre.repository.read';

let genreRepositoryRead: jest.Mocked<IGenreRepositoryRead>;
let genreService: GenreService;

beforeEach(() => {
  genreRepositoryRead = {
    listGenres: jest.fn(),
    findGenresByIds: jest.fn(),
    findGenresByTmdbIds: jest.fn(),
  };
  genreService = new GenreService({ genreRepositoryRead });
});

describe('When we list the genres', () => {
  it('should return them in the repository order with only id and name', async () => {
    genreRepositoryRead.listGenres.mockResolvedValue([
      { _id: 'genre-1', name: 'Ação', tmdbGenreId: 28 },
      { _id: 'genre-2', name: 'Drama', tmdbGenreId: 18 },
    ]);

    await expect(genreService.listGenres()).resolves.toEqual([
      { id: 'genre-1', name: 'Ação' },
      { id: 'genre-2', name: 'Drama' },
    ]);
  });

  it('should log and rethrow an unexpected repository error', async () => {
    const loggerSpy = jest.spyOn(Logger, 'error').mockImplementation();
    genreRepositoryRead.listGenres.mockRejectedValue(new Error('db down'));

    await expect(genreService.listGenres()).rejects.toThrow('db down');
    expect(loggerSpy).toHaveBeenCalledWith(
      'Unexpected error in GenreService.listGenres',
      expect.objectContaining({ eventName: 'service.unexpected_error' }),
    );
    loggerSpy.mockRestore();
  });
});
