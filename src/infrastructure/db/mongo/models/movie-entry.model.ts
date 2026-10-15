import mongoose from 'mongoose';
import { IMMovieEntry, movieEntrySchema } from '../schema/movie-entry.schema';

export const MmovieEntry = mongoose.model<IMMovieEntry>(
  'movieEntry',
  movieEntrySchema,
);
