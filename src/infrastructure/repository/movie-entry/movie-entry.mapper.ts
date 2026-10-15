import { UpdateQuery } from 'mongoose';
import {
  IMovieEntry,
  IMovieEntryData,
} from '../../../domain/movie-entry/interfaces/movie-entry.interface';
import { toObjectId } from '../../db/mongo/object-id';
import { IMMovieEntry } from '../../db/mongo/schema/movie-entry.schema';

export function toMovieEntry(document: IMMovieEntry): IMovieEntry {
  return {
    ...document,
    _id: document._id.toString(),
    userId: document.userId.toString(),
    genreIds: document.genreIds.map((genreId) => genreId.toString()),
  };
}

export function toMovieEntryDocument(
  movieData: IMovieEntryData,
): Omit<IMMovieEntry, '_id'> {
  return {
    ...movieData,
    userId: toObjectId(movieData.userId),
    genreIds: movieData.genreIds.map(toObjectId),
  };
}

// Mongoose drops undefined keys from updates, so clearing an optional field
// (e.g. removePoster) has to become an explicit $unset.
export function toMovieEntryUpdate(
  movieData: Partial<IMovieEntryData>,
): UpdateQuery<IMMovieEntry> {
  const $set: Partial<IMMovieEntry> = {};
  const $unset: Record<string, ''> = {};

  for (const [field, value] of Object.entries(movieData)) {
    if (value === undefined) {
      $unset[field] = '';
    } else if (field === 'userId') {
      $set.userId = toObjectId(value as string);
    } else if (field === 'genreIds') {
      $set.genreIds = (value as string[]).map(toObjectId);
    } else {
      Object.assign($set, { [field]: value });
    }
  }

  return Object.keys($unset).length ? { $set, $unset } : { $set };
}
