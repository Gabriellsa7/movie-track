export interface IUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type IUserPrivate = Omit<IUser, 'passwordHash' | 'avatarPublicId'>;
