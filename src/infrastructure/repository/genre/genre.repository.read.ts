import { IGenre } from '../../../domain/genre/interfaces/genre.interface';
import { IGenreRepositoryRead } from '../../../domain/genre/repository/genre.repository.read';
import { Mgenre } from '../../db/mongo/models/genre.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMGenre } from '../../db/mongo/schema/genre.schema';
import { toGenre } from './genre.mapper';

const NAME_COLLATION = { locale: 'pt' };

export class GenreRepositoryRead implements IGenreRepositoryRead {
  async listGenres(): Promise<IGenre[]> {
    const genres = await Mgenre.find({}, HIDE_MONGO_INTERNAL_FIELDS)
      .collation(NAME_COLLATION)
      .sort({ name: 1 })
      .lean<IMGenre[]>();
    return genres.map(toGenre);
  }

  async findGenresByIds(ids: string[]): Promise<IGenre[]> {
    const objectIds = ids.filter(isObjectId).map(toObjectId);
    if (objectIds.length === 0) {
      return [];
    }
    const genres = await Mgenre.find(
      { _id: { $in: objectIds } },
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMGenre[]>();
    return genres.map(toGenre);
  }

  async findGenresByTmdbIds(tmdbGenreIds: number[]): Promise<IGenre[]> {
    if (tmdbGenreIds.length === 0) {
      return [];
    }
    const genres = await Mgenre.find(
      { tmdbGenreId: { $in: tmdbGenreIds } },
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMGenre[]>();
    return genres.map(toGenre);
  }
}
