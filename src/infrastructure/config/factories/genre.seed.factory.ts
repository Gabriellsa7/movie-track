import { GenreSeed } from '../../db/mongo/seed/genre.seed';
import { GenreRepositoryWrite } from '../../repository/genre/genre.repository.write';

export class GenreSeedFactory {
  static create(): GenreSeed {
    return new GenreSeed(new GenreRepositoryWrite());
  }
}
