import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IMUser } from '../../db/mongo/schema/user.schema';

export type IMUserDocument = Omit<IMUser, 'normalizedName'>;

export function toUser(document: IMUserDocument): IUser {
  return { ...document, _id: document._id.toString() };
}
