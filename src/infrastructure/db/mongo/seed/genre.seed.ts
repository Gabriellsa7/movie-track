import { Logger } from 'traceability';
import { Genre } from '../../../../domain/genre/genre.entity';
import { IParamsGenre } from '../../../../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryWrite } from '../../../../domain/genre/repository/genre.repository.write';

export const GENRE_SEED: IParamsGenre[] = [
  { tmdbGenreId: 28, name: 'Action' },
  { tmdbGenreId: 12, name: 'Adventure' },
  { tmdbGenreId: 16, name: 'Animation' },
  { tmdbGenreId: 35, name: 'Comedy' },
  { tmdbGenreId: 80, name: 'Crime' },
  { tmdbGenreId: 99, name: 'Documentary' },
  { tmdbGenreId: 18, name: 'Drama' },
  { tmdbGenreId: 10751, name: 'Family' },
  { tmdbGenreId: 14, name: 'Fantasy' },
  { tmdbGenreId: 36, name: 'History' },
  { tmdbGenreId: 27, name: 'Horror' },
  { tmdbGenreId: 10402, name: 'Music' },
  { tmdbGenreId: 9648, name: 'Mystery' },
  { tmdbGenreId: 10749, name: 'Romance' },
  { tmdbGenreId: 878, name: 'Science Fiction' },
  { tmdbGenreId: 10770, name: 'TV Movie' },
  { tmdbGenreId: 53, name: 'Thriller' },
  { tmdbGenreId: 10752, name: 'War' },
  { tmdbGenreId: 37, name: 'Western' },
];

export class GenreSeed {
  private readonly genreRepositoryWrite: IGenreRepositoryWrite;

  constructor(genreRepositoryWrite: IGenreRepositoryWrite) {
    this.genreRepositoryWrite = genreRepositoryWrite;
  }

  async run(): Promise<void> {
    const genres = GENRE_SEED.map((params) => new Genre(params));
    await this.genreRepositoryWrite.upsertGenres(genres);
    Logger.info('Genres seeded', {
      eventName: 'genre.seeded',
      count: genres.length,
    });
  }
}
