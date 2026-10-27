export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  avatarPublicId?: string;
  // Absent for users created before it existed; read as 0.
  sessionVersion?: number;
  // Absent for users created before it existed; read as false.
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
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
  emailVerified?: boolean;
  emailVerificationTokenHash?: string;
  emailVerificationExpiresAt?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IUserProfileData = Partial<Pick<IUser, 'name' | 'email'>>;

export type IUserData = Omit<IUser, '_id'>;

export type IUserPrivate = Omit<
  IUser,
  | '_id'
  | 'passwordHash'
  | 'avatarPublicId'
  | 'sessionVersion'
  | 'emailVerified'
  | 'emailVerificationTokenHash'
  | 'emailVerificationExpiresAt'
  | 'passwordResetTokenHash'
  | 'passwordResetExpiresAt'
> & {
  id: string;
  emailVerified: boolean;
};

export interface IUserMoviesSummary {
  moviesCount: number;
  averageRating: number | null;
  favoritesCount: number;
}

export interface IUserPublicSummary extends IUserMoviesSummary {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface IUserPublicProfile extends IUserPublicSummary {
  memberSince: Date;
}
