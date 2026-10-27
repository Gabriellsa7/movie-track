import mongoose, { Types } from 'mongoose';
import { IMovieEntry } from '../../../../domain/movie-entry/interfaces/movie-entry.interface';

export interface IMMovieEntry
  extends Omit<IMovieEntry, '_id' | 'userId' | 'genreIds'> {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  genreIds: Types.ObjectId[];
}

export const movieEntrySchema = new mongoose.Schema<IMMovieEntry>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    tmdbId: {
      type: Number,
    },
    title: {
      type: String,
      required: true,
    },
    normalizedTitle: {
      type: String,
      required: true,
    },
    synopsis: {
      type: String,
      required: true,
    },
    posterUrl: {
      type: String,
    },
    posterPublicId: {
      type: String,
    },
    releaseYear: {
      type: Number,
      required: true,
    },
    genreIds: {
      type: [mongoose.Schema.Types.ObjectId],
      required: true,
    },
    director: {
      type: String,
    },
    durationMinutes: {
      type: Number,
    },
    rating: {
      type: Number,
      required: true,
    },
    review: {
      type: String,
    },
    watchedAt: {
      type: Date,
      required: true,
    },
    // Not required: entries logged before it existed read as 1 (see toMovieEntry).
    watchCount: {
      type: Number,
    },
    isFavorite: {
      type: Boolean,
      required: true,
    },
    createdAt: {
      type: Date,
      required: true,
    },
    updatedAt: {
      type: Date,
      required: true,
    },
  },
  { versionKey: false },
);

movieEntrySchema.index({ userId: 1, watchedAt: -1, _id: 1 });
movieEntrySchema.index({ userId: 1, normalizedTitle: 1, releaseYear: 1 });
movieEntrySchema.index({ userId: 1, tmdbId: 1 });
