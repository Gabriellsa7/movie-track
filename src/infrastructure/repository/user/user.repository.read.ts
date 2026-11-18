import { FilterQuery } from 'mongoose';
import { IPagination } from '../../../domain/common/pagination.interface';
import { normalizeText } from '../../../domain/common/text.normalizer';
import {
  IUser,
  IUserSearchFilter,
} from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_USER_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { isObjectId, toObjectId } from '../../db/mongo/object-id';
import { IMUser } from '../../db/mongo/schema/user.schema';
import { IMUserDocument, toUser } from './user.mapper';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

export class UserRepositoryRead implements IUserRepositoryRead {
  async findUserById(id: string): Promise<IUser | null> {
    if (!isObjectId(id)) {
      return null;
    }
    const user = await Muser.findOne(
      { _id: toObjectId(id) },
      HIDE_USER_INTERNAL_FIELDS,
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }

  async findUserByEmailVerificationTokenHash(
    tokenHash: string,
  ): Promise<IUser | null> {
    const user = await Muser.findOne(
      { emailVerificationTokenHash: tokenHash },
      HIDE_USER_INTERNAL_FIELDS,
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }

  async findUserByPasswordResetTokenHash(
    tokenHash: string,
  ): Promise<IUser | null> {
    const user = await Muser.findOne(
      { passwordResetTokenHash: tokenHash },
      HIDE_USER_INTERNAL_FIELDS,
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    const user = await Muser.findOne(
      { email },
      HIDE_USER_INTERNAL_FIELDS,
    ).lean<IMUserDocument>();
    return user && toUser(user);
  }

  async searchUsers(
    filter: IUserSearchFilter,
    pagination: IPagination,
  ): Promise<IUser[]> {
    const users = await Muser.find(
      this.buildSearchFilter(filter),
      HIDE_USER_INTERNAL_FIELDS,
    )
      .sort({ normalizedName: 1, _id: 1 })
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean<IMUserDocument[]>();
    return users.map(toUser);
  }

  async countUsers(filter: IUserSearchFilter): Promise<number> {
    return Muser.countDocuments(this.buildSearchFilter(filter));
  }

  private buildSearchFilter({
    search,
    ids,
  }: IUserSearchFilter): FilterQuery<IMUser> {
    const query: FilterQuery<IMUser> = {};
    const normalizedSearch = search ? normalizeText(search) : '';
    if (normalizedSearch) {
      query.normalizedName = {
        $regex: normalizedSearch.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'),
      };
    }
    if (ids) {
      query._id = { $in: ids.filter(isObjectId).map(toObjectId) };
    }
    return query;
  }
}
