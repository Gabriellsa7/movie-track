import {
  IMovieEntry,
  IMovieEntryData,
} from '../../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryRepositoryWrite } from '../../../domain/movie-entry/repository/movie-entry.repository.write';
import { MmovieEntry } from '../../db/mongo/models/movie-entry.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMMovieEntry } from '../../db/mongo/schema/movie-entry.schema';
import {
  toMovieEntry,
  toMovieEntryDocument,
  toMovieEntryUpdate,
} from './movie-entry.mapper';

export class MovieEntryRepositoryWrite implements IMovieEntryRepositoryWrite {
  async createMovieEntry(movieData: IMovieEntryData): Promise<IMovieEntry> {
    const createdMovieEntry = await MmovieEntry.create(
      toMovieEntryDocument(movieData),
    );
    return toMovieEntry(createdMovieEntry.toObject());
  }

  async updateMovieEntryById(
    id: string,
    userId: string,
    movieData: Partial<IMovieEntryData>,
  ): Promise<IMovieEntry | null> {
    if (!isObjectId(id) || !isObjectId(userId)) {
      return null;
    }
    const movieEntry = await MmovieEntry.findOneAndUpdate(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      toMovieEntryUpdate(movieData),
      { new: true, projection: HIDE_MONGO_INTERNAL_FIELDS },
    ).lean<IMMovieEntry>();
    return movieEntry && toMovieEntry(movieEntry);
  }

  async deleteMovieEntryById(
    id: string,
    userId: string,
  ): Promise<IMovieEntry | null> {
    if (!isObjectId(id) || !isObjectId(userId)) {
      return null;
    }
    const movieEntry = await MmovieEntry.findOneAndDelete(
      { _id: toObjectId(id), userId: toObjectId(userId) },
      { projection: HIDE_MONGO_INTERNAL_FIELDS },
    ).lean<IMMovieEntry>();
    return movieEntry && toMovieEntry(movieEntry);
  }

  // Returns the deleted entries so the caller can clean up their posters in storage.
  async deleteMovieEntriesByUserId(userId: string): Promise<IMovieEntry[]> {
    if (!isObjectId(userId)) {
      return [];
    }
    const filter = { userId: toObjectId(userId) };
    const movieEntries = await MmovieEntry.find(
      filter,
      HIDE_MONGO_INTERNAL_FIELDS,
    ).lean<IMMovieEntry[]>();
    await MmovieEntry.deleteMany(filter);
    return movieEntries.map(toMovieEntry);
  }
}
