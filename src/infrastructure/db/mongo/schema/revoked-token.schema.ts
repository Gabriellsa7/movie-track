import mongoose, { Types } from 'mongoose';
import { IRevokedToken } from '../../../../domain/auth/interfaces/revoked-token.interface';

export interface IMRevokedToken extends IRevokedToken {
  _id: Types.ObjectId;
}

export const revokedTokenSchema = new mongoose.Schema<IMRevokedToken>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
    },
    // TTL index: MongoDB deletes the entry once the token would be expired anyway.
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { versionKey: false },
);
