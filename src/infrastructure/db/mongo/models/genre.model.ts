import mongoose from 'mongoose';
import { IMGenre, genreSchema } from '../schema/genre.schema';

export const Mgenre = mongoose.model<IMGenre>('genre', genreSchema);
