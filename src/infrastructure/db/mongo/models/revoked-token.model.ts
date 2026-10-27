import mongoose from 'mongoose';
import {
  IMRevokedToken,
  revokedTokenSchema,
} from '../schema/revoked-token.schema';

export const MrevokedToken = mongoose.model<IMRevokedToken>(
  'revokedToken',
  revokedTokenSchema,
);
