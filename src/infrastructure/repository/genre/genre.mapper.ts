import { IGenre } from '../../../domain/genre/interfaces/genre.interface';
import { IMGenre } from '../../db/mongo/schema/genre.schema';

export function toGenre(document: IMGenre): IGenre {
  return { ...document, _id: document._id.toString() };
}
