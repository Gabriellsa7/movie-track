import mongoose, { Types } from 'mongoose';
import { IGenre } from '../../../../domain/genre/interfaces/genre.interface';

export interface IMGenre extends Omit<IGenre, '_id'> {
  _id: Types.ObjectId;
}

export const genreSchema = new mongoose.Schema<IMGenre>(
  {
    name: {
      type: String,
      required: true,
    },
    tmdbGenreId: {
      type: Number,
      required: true,
      unique: true,
    },
    translatedNames: {
      type: { 'pt-BR': String },
      _id: false,
    },
  },
  { versionKey: false },
);
