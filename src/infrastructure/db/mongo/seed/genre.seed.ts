import { Logger } from 'traceability';
import { ELanguage } from '../../../../domain/common/language';
import { Genre } from '../../../../domain/genre/genre.entity';
import { IParamsGenre } from '../../../../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryWrite } from '../../../../domain/genre/repository/genre.repository.write';

// Portuguese names are TMDB's own (GET /genre/movie/list?language=pt-BR).
export const GENRE_SEED: IParamsGenre[] = [
  {
    tmdbGenreId: 28,
    name: 'Action',
    translatedNames: { [ELanguage.PT_BR]: 'Ação' },
  },
  {
    tmdbGenreId: 12,
    name: 'Adventure',
    translatedNames: { [ELanguage.PT_BR]: 'Aventura' },
  },
  {
    tmdbGenreId: 16,
    name: 'Animation',
    translatedNames: { [ELanguage.PT_BR]: 'Animação' },
  },
  {
    tmdbGenreId: 35,
    name: 'Comedy',
    translatedNames: { [ELanguage.PT_BR]: 'Comédia' },
  },
  {
    tmdbGenreId: 80,
    name: 'Crime',
    translatedNames: { [ELanguage.PT_BR]: 'Crime' },
  },
  {
    tmdbGenreId: 99,
    name: 'Documentary',
    translatedNames: { [ELanguage.PT_BR]: 'Documentário' },
  },
  {
    tmdbGenreId: 18,
    name: 'Drama',
    translatedNames: { [ELanguage.PT_BR]: 'Drama' },
  },
  {
    tmdbGenreId: 10751,
    name: 'Family',
    translatedNames: { [ELanguage.PT_BR]: 'Família' },
  },
  {
    tmdbGenreId: 14,
    name: 'Fantasy',
    translatedNames: { [ELanguage.PT_BR]: 'Fantasia' },
  },
  {
    tmdbGenreId: 36,
    name: 'History',
    translatedNames: { [ELanguage.PT_BR]: 'História' },
  },
  {
    tmdbGenreId: 27,
    name: 'Horror',
    translatedNames: { [ELanguage.PT_BR]: 'Terror' },
  },
  {
    tmdbGenreId: 10402,
    name: 'Music',
    translatedNames: { [ELanguage.PT_BR]: 'Música' },
  },
  {
    tmdbGenreId: 9648,
    name: 'Mystery',
    translatedNames: { [ELanguage.PT_BR]: 'Mistério' },
  },
  {
    tmdbGenreId: 10749,
    name: 'Romance',
    translatedNames: { [ELanguage.PT_BR]: 'Romance' },
  },
  {
    tmdbGenreId: 878,
    name: 'Science Fiction',
    translatedNames: { [ELanguage.PT_BR]: 'Ficção científica' },
  },
  {
    tmdbGenreId: 10770,
    name: 'TV Movie',
    translatedNames: { [ELanguage.PT_BR]: 'Cinema TV' },
  },
  {
    tmdbGenreId: 53,
    name: 'Thriller',
    translatedNames: { [ELanguage.PT_BR]: 'Thriller' },
  },
  {
    tmdbGenreId: 10752,
    name: 'War',
    translatedNames: { [ELanguage.PT_BR]: 'Guerra' },
  },
  {
    tmdbGenreId: 37,
    name: 'Western',
    translatedNames: { [ELanguage.PT_BR]: 'Faroeste' },
  },
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
