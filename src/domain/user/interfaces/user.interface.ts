export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  // Absent for users created before it existed; read as 0.
  sessionVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IParamsUser {
  _id?: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  sessionVersion?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserProfileData = Partial<Pick<IUser, 'name' | 'email'>>;

export type IUserData = Omit<IUser, '_id'>;

export type IUserPrivate = Omit<
  IUser,
  '_id' | 'passwordHash' | 'avatarPublicId' | 'sessionVersion'
> & {
  id: string;
};

export interface IUserPublicSummary {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface IUserPublicProfile extends IUserPublicSummary {
  memberSince: Date;
}
