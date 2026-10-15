import { FilterQuery } from 'mongoose';
import { IPagination } from '../../../domain/common/pagination.interface';
import { normalizeText } from '../../../domain/common/text.normalizer';
import { IUser } from '../../../domain/user/interfaces/user.interface';
import { IUserRepositoryRead } from '../../../domain/user/repository/user.repository.read';
import { Muser } from '../../db/mongo/models/user.model';
import { HIDE_USER_INTERNAL_FIELDS } from '../../db/mongo/mongo.projection';
import { IMUser } from '../../db/mongo/schema/user.schema';

const REGEX_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

export class UserRepositoryRead implements IUserRepositoryRead {
  async findUserById(id: string): Promise<IUser | null> {
    return Muser.findOne({ id }, HIDE_USER_INTERNAL_FIELDS).lean<IUser>();
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    return Muser.findOne({ email }, HIDE_USER_INTERNAL_FIELDS).lean<IUser>();
  }

  async searchUsers(
    search: string | undefined,
    pagination: IPagination,
  ): Promise<IUser[]> {
    return Muser.find(this.buildSearchFilter(search), HIDE_USER_INTERNAL_FIELDS)
      .sort({ normalizedName: 1, id: 1 })
      .skip(pagination.offset)
      .limit(pagination.limit)
      .lean<IUser[]>();
  }

  async countUsers(search: string | undefined): Promise<number> {
    return Muser.countDocuments(this.buildSearchFilter(search));
  }

  private buildSearchFilter(search: string | undefined): FilterQuery<IMUser> {
    const normalizedSearch = search ? normalizeText(search) : '';
    if (!normalizedSearch) {
      return {};
    }
    return {
      normalizedName: {
        $regex: normalizedSearch.replace(REGEX_SPECIAL_CHARACTERS, '\\$&'),
      },
    };
  }
}
