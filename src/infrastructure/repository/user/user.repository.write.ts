import {
  IUser,
  IUserData,
} from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryWrite } from '../../../domain/user/repository/user.repository.write';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_USER_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMUserDocument, toUser, toUserUpdate } from './user.mapper';

export class UserRepositoryWrite implements IUserRepositoryWrite {
  async createUser(userData: IUserData): Promise<IUser> {
    const createdUser = await Muser.create(userData);
    return {
      _id: createdUser._id.toString(),
      name: createdUser.name,
      email: createdUser.email,
      passwordHash: createdUser.passwordHash,
      avatarUrl: createdUser.avatarUrl,
      avatarPublicId: createdUser.avatarPublicId,
      sessionVersion: createdUser.sessionVersion,
      emailVerified: createdUser.emailVerified,
      emailVerificationTokenHash: createdUser.emailVerificationTokenHash,
      emailVerificationExpiresAt: createdUser.emailVerificationExpiresAt,
      createdAt: createdUser.createdAt,
      updatedAt: createdUser.updatedAt,
    };
  }

  async updateUserById(
    id: string,
    updateData: Partial<IUserData>,
  ): Promise<IUser | null> {
    if (!isObjectId(id)) {
      return null;
    }
    const user = await Muser.findOneAndUpdate(
      { _id: toObjectId(id) },
      toUserUpdate(updateData),
      { new: true, projection: HIDE_USER_INTERNAL_FIELDS },
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }

  async deleteUserById(id: string): Promise<IUser | null> {
    if (!isObjectId(id)) {
      return null;
    }
    const user = await Muser.findOneAndDelete(
      { _id: toObjectId(id) },
      { projection: HIDE_USER_INTERNAL_FIELDS },
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }
}
