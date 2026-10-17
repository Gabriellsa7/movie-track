import { IGenreData } from '../../../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryWrite } from '../../../domain/genre/repository/genre.repository.write';
import { Mgenre } from '../../db/mongo/models/genre.model';

export class GenreRepositoryWrite implements IGenreRepositoryWrite {
  async upsertGenres(genres: IGenreData[]): Promise<void> {
    if (genres.length === 0) {
      return;
    }
    await Mgenre.init();
    await Mgenre.bulkWrite(
      genres.map((genre) => ({
        updateOne: {
          filter: { tmdbGenreId: genre.tmdbGenreId },
          update: { $set: { name: genre.name } },
          upsert: true,
        },
      })),
    );
  }
}
