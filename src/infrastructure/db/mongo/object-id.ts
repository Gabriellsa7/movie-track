import { Types } from 'mongoose';

// Types.ObjectId.isValid also accepts any 12-character string, so match the hex form only.
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export function isObjectId(id: string): boolean {
  return OBJECT_ID_PATTERN.test(id);
}

export function toObjectId(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}
