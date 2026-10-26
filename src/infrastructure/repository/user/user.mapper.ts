import { UpdateQuery } from 'mongoose';
import {
  IUser,
  IUserData,
} from '../../../domain/user/interfaces/user.interface';
import { IMUser } from '../../db/mongo/schema/user.schema';

export type IMUserDocument = Omit<IMUser, 'normalizedName'>;

export function toUser(document: IMUserDocument): IUser {
  return { ...document, _id: document._id.toString() };
}

// Mongoose drops undefined keys from updates, so clearing an optional field
// (e.g. removeAvatar) has to become an explicit $unset.
export function toUserUpdate(
  userData: Partial<IUserData>,
): UpdateQuery<IMUser> {
  const $set: Partial<IMUser> = {};
  const $unset: Record<string, ''> = {};

  for (const [field, value] of Object.entries(userData)) {
    if (value === undefined) {
      $unset[field] = '';
    } else {
      Object.assign($set, { [field]: value });
    }
  }

  return Object.keys($unset).length ? { $set, $unset } : { $set };
}
