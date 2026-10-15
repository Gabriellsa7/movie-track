import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryWrite } from '../../../domain/user/repository/user.repository.write';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_USER_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';

export class UserRepositoryWrite implements IUserRepositoryWrite {
  async createUser(userData: IUser): Promise<IUser> {
    const createdUser = await Muser.create(userData);
    return {
      id: createdUser.id,
      name: createdUser.name,
      email: createdUser.email,
      passwordHash: createdUser.passwordHash,
      avatarUrl: createdUser.avatarUrl,
      avatarPublicId: createdUser.avatarPublicId,
      createdAt: createdUser.createdAt,
      updatedAt: createdUser.updatedAt,
    };
  }

  async updateUserById(
    id: string,
    updateData: Partial<IUser>,
  ): Promise<IUser | null> {
    return Muser.findOneAndUpdate({ id }, updateData, {
      new: true,
      projection: HIDE_USER_INTERNAL_FIELDS,
    }).lean<IUser>();
  }

  async deleteUserById(id: string): Promise<IUser | null> {
    return Muser.findOneAndDelete(
      { id },
      { projection: HIDE_USER_INTERNAL_FIELDS },
    ).lean<IUser>();
  }
}
