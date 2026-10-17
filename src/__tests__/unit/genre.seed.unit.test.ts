import { Logger } from 'traceability';
import { IGenreRepositoryWrite } from '../../domain/genre/repository/genre.repository.write';
import {
  GENRE_SEED,
  GenreSeed,
} from '../../infrastructure/db/mongo/seed/genre.seed';

describe('When we run the genre seed', () => {
  it('should upsert every TMDB genre and log the count', async () => {
    const loggerSpy = jest.spyOn(Logger, 'info').mockImplementation();
    const genreRepositoryWrite: jest.Mocked<IGenreRepositoryWrite> = {
      upsertGenres: jest.fn().mockResolvedValue(undefined),
    };

    await new GenreSeed(genreRepositoryWrite).run();

    const [genres] = genreRepositoryWrite.upsertGenres.mock.calls[0];
    expect(genres).toHaveLength(GENRE_SEED.length);
    expect(genres).toContainEqual(
      expect.objectContaining({ name: 'Drama', tmdbGenreId: 18 }),
    );
    expect(loggerSpy).toHaveBeenCalledWith('Genres seeded', {
      eventName: 'genre.seeded',
      count: GENRE_SEED.length,
    });
    loggerSpy.mockRestore();
  });

  it('should have one entry per TMDB genre id', () => {
    const tmdbGenreIds = GENRE_SEED.map((genre) => genre.tmdbGenreId);

    expect(new Set(tmdbGenreIds).size).toBe(tmdbGenreIds.length);
  });
});
