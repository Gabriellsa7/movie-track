import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
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
  async listGenres(): Promise<IGenreResponse[]> {
    const genres = await this.genreRepositoryRead.listGenres();
    return genres.map(Genre.toGenreResponse);
  }
}
