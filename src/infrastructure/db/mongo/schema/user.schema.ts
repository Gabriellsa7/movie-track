import mongoose, { Types } from 'mongoose';
import { IUser } from '../../../../domain/user/interfaces/user.interface';

export interface IMUser extends IUser {
  _id: Types.ObjectId;
}

export const userSchema = new mongoose.Schema<IMUser>({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address',
    ],
  },
  passwordHash: {
    type: String,
    required: true,
  },
  avatarUrl: {
    type: String,
  },
  avatarPublicId: {
    type: String,
  },
  createdAt: {
    type: Date,
    required: true,
  },
  updatedAt: {
    type: Date,
    required: true,
  },
});
