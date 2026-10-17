import { Logger } from 'traceability';
import { Genre } from '../../../../domain/genre/genre.entity';
import { IParamsGenre } from '../../../../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryWrite } from '../../../../domain/genre/repository/genre.repository.write';

export const GENRE_SEED: IParamsGenre[] = [
  { tmdbGenreId: 28, name: 'Ação' },
  { tmdbGenreId: 12, name: 'Aventura' },
  { tmdbGenreId: 16, name: 'Animação' },
  { tmdbGenreId: 35, name: 'Comédia' },
  { tmdbGenreId: 80, name: 'Crime' },
  { tmdbGenreId: 99, name: 'Documentário' },
  { tmdbGenreId: 18, name: 'Drama' },
  { tmdbGenreId: 10751, name: 'Família' },
  { tmdbGenreId: 14, name: 'Fantasia' },
  { tmdbGenreId: 36, name: 'História' },
  { tmdbGenreId: 27, name: 'Terror' },
  { tmdbGenreId: 10402, name: 'Música' },
  { tmdbGenreId: 9648, name: 'Mistério' },
  { tmdbGenreId: 10749, name: 'Romance' },
  { tmdbGenreId: 878, name: 'Ficção científica' },
  { tmdbGenreId: 10770, name: 'Cinema TV' },
  { tmdbGenreId: 53, name: 'Thriller' },
  { tmdbGenreId: 10752, name: 'Guerra' },
  { tmdbGenreId: 37, name: 'Faroeste' },
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
