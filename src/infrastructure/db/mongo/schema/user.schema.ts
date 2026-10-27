import mongoose, { Types, UpdateQuery } from 'mongoose';
import { IUser } from '../../../../domain/user/interfaces/user.interface';
import { normalizeText } from '../../../../domain/common/text.normalizer';

export interface IMUser extends Omit<IUser, '_id'> {
  _id: Types.ObjectId;
  normalizedName: string;
}

export const userSchema = new mongoose.Schema<IMUser>(
  {
  name: {
    type: String,
    required: true,
  },
  normalizedName: {
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
  sessionVersion: {
    type: Number,
  },
  emailVerified: {
    type: Boolean,
  },
  emailVerificationTokenHash: {
    type: String,
  },
  emailVerificationExpiresAt: {
    type: Date,
  },
  passwordResetTokenHash: {
    type: String,
  },
  passwordResetExpiresAt: {
    type: Date,
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

userSchema.index({ normalizedName: 1, _id: 1 });
userSchema.index({ emailVerificationTokenHash: 1 }, { sparse: true });
userSchema.index({ passwordResetTokenHash: 1 }, { sparse: true });

userSchema.pre('validate', function () {
  if (this.isModified('name')) {
    this.normalizedName = normalizeText(this.name);
  }
});

userSchema.pre('findOneAndUpdate', function () {
  const update = this.getUpdate() as UpdateQuery<IMUser>;
  const name = update.$set?.name ?? update.name;
  if (typeof name === 'string') {
    this.set('normalizedName', normalizeText(name));
  }
});
