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

export interface IParamsUser {
  id?: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserProfileData = Partial<Pick<IUser, 'name' | 'email'>>;

export type IUserPrivate = Omit<IUser, 'passwordHash' | 'avatarPublicId'>;

export interface IUserPublicSummary {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface IUserPublicProfile extends IUserPublicSummary {
  memberSince: Date;
}
