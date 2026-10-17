import { GenreService } from '../../../domain/genre/service/genre.service';
import { GenreRepositoryRead } from '../../repository/genre/genre.repository.read';

export class GenreServiceFactory {
  static create() {
    return new GenreService({
      genreRepositoryRead: new GenreRepositoryRead(),
    });
  }
}
