import { IPagination } from '../../../domain/common/pagination.interface';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_MONGO_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';

export class UserRepositoryRead implements IUserRepositoryRead {
  async findUserById(id: string): Promise<IUser | null> {
    return Muser.findOne({ id }, HIDE_MONGO_INTERNAL_FIELDS).lean<IUser>();
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    return Muser.findOne({ email }, HIDE_MONGO_INTERNAL_FIELDS).lean<IUser>();
  }

  async listUsers(
    filter: Partial<IUser>,
    pagination: IPagination,
  ): Promise<IUser[]> {
    return Muser.find(filter, HIDE_MONGO_INTERNAL_FIELDS)
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean<IUser[]>();
  }
}
