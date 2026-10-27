import {
  IParamsUser,
  IUser,
  IUserData,
  IUserMoviesSummary,
  IUserPrivate,
  IUserProfileData,
  IUserPublicProfile,
  IUserPublicSummary,
} from './interfaces/user.interface';

export class User implements IUserData {
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

  createdAt: Date;

  updatedAt: Date;

  constructor(params: IParamsUser) {
    this.name = params.name.trim();
    this.email = User.normalizeEmail(params.email);
    this.passwordHash = params.passwordHash;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? this.createdAt;

    if (params._id) {
      this._id = params._id;
    }

    if (params.avatarUrl) {
      this.avatarUrl = params.avatarUrl;
    }

    if (params.avatarPublicId) {
      this.avatarPublicId = params.avatarPublicId;
    }

    if (params.sessionVersion !== undefined) {
      this.sessionVersion = params.sessionVersion;
    }

    if (params.emailVerified !== undefined) {
      this.emailVerified = params.emailVerified;
    }

    if (params.emailVerificationTokenHash) {
      this.emailVerificationTokenHash = params.emailVerificationTokenHash;
      this.emailVerificationExpiresAt = params.emailVerificationExpiresAt;
    }

    if (params.passwordResetTokenHash) {
      this.passwordResetTokenHash = params.passwordResetTokenHash;
      this.passwordResetExpiresAt = params.passwordResetExpiresAt;
    }
  }

  updateProfile(profileData: IUserProfileData, updatedAt: Date): void {
    if (profileData.name !== undefined) {
      this.name = profileData.name.trim();
    }

    if (profileData.email !== undefined) {
      this.email = User.normalizeEmail(profileData.email);
    }

    this.updatedAt = updatedAt;
  }

  // A new version revokes every refresh token issued with the old password.
  changePasswordHash(passwordHash: string, updatedAt: Date): void {
    this.passwordHash = passwordHash;
    this.sessionVersion = (this.sessionVersion ?? 0) + 1;
    this.updatedAt = updatedAt;
  }

  // A new token replaces any pending one, so only the latest e-mail's link works.
  startEmailVerification(tokenHash: string, expiresAt: Date): void {
    this.emailVerified = false;
    this.emailVerificationTokenHash = tokenHash;
    this.emailVerificationExpiresAt = expiresAt;
  }

  confirmEmail(updatedAt: Date): void {
    this.emailVerified = true;
    this.emailVerificationTokenHash = undefined;
    this.emailVerificationExpiresAt = undefined;
    this.updatedAt = updatedAt;
  }

  startPasswordReset(tokenHash: string, expiresAt: Date): void {
    this.passwordResetTokenHash = tokenHash;
    this.passwordResetExpiresAt = expiresAt;
  }

  // Following the link proves access to the inbox, so it also confirms the e-mail.
  resetPassword(passwordHash: string, updatedAt: Date): void {
    this.changePasswordHash(passwordHash, updatedAt);
    this.passwordResetTokenHash = undefined;
    this.passwordResetExpiresAt = undefined;
    this.confirmEmail(updatedAt);
  }

  changeAvatar(avatarUrl: string, avatarPublicId: string, updatedAt: Date): void {
    this.avatarUrl = avatarUrl;
    this.avatarPublicId = avatarPublicId;
    this.updatedAt = updatedAt;
  }

  removeAvatar(updatedAt: Date): void {
    this.avatarUrl = undefined;
    this.avatarPublicId = undefined;
    this.updatedAt = updatedAt;
  }

  public static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  public static toUserPrivate(data: IUser): IUserPrivate {
    const user: IUserPrivate = {
      id: data._id,
      name: data.name,
      email: data.email,
      emailVerified: data.emailVerified ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };

    if (data.avatarUrl) {
      user.avatarUrl = data.avatarUrl;
    }

    return user;
  }

  public static toUserPublicSummary(
    data: IUser,
    moviesSummary: IUserMoviesSummary,
  ): IUserPublicSummary {
    const user: IUserPublicSummary = {
      id: data._id,
      name: data.name,
      ...moviesSummary,
    };

    if (data.avatarUrl) {
      user.avatarUrl = data.avatarUrl;
    }

    return user;
  }

  public static toUserPublicProfile(
    data: IUser,
    moviesSummary: IUserMoviesSummary,
  ): IUserPublicProfile {
    return {
      ...User.toUserPublicSummary(data, moviesSummary),
      memberSince: data.createdAt,
    };
  }
}
