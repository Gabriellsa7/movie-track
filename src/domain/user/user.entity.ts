import { IUser } from './interfaces/user.interface';

export class User implements IUser {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly passwordHash: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly avatarUrl?: string,
    public readonly avatarPublicId?: string,
  ) {}
}
