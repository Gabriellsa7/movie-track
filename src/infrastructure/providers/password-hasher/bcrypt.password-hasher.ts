import bcrypt from 'bcryptjs';
import { IPasswordHasher } from '../../../domain/common/providers/password-hasher.provider';

export class BcryptPasswordHasher implements IPasswordHasher {
  constructor(private readonly rounds: number) {}

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.rounds);
  }

  async compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, passwordHash);
  }
}
