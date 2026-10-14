import { IUser } from './interfaces/user.interface';

export class User implements IUser {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly createdAt: Date,
  ) {}
}
