import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { ELanguage } from '../../common/language';
import { Genre } from '../genre.entity';
import { IGenreResponse } from '../interfaces/genre.interface';
import {
  IGenreService,
  IParamsGenreService,
} from '../interfaces/genre.service.interface';
import { IGenreRepositoryRead } from '../repository/genre.repository.read';

export class GenreService implements IGenreService {
  private genreRepositoryRead: IGenreRepositoryRead;

  constructor({ genreRepositoryRead }: IParamsGenreService) {
    this.genreRepositoryRead = genreRepositoryRead;
  }

  @ErrorHandler()
  async listGenres(language: ELanguage): Promise<IGenreResponse[]> {
    const genres = await this.genreRepositoryRead.listGenres();
    // Sorted here because the order changes with the language (Ação comes first, Action does not).
    return genres
      .map((genre) => Genre.toGenreResponse(genre, language))
      .sort((first, second) =>
        first.name.localeCompare(second.name, language, {
          sensitivity: 'base',
        }),
      );
  }
}
