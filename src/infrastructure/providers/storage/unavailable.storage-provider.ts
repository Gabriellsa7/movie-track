import {
  IStorageProvider,
  IStoredFile,
} from '../../../domain/common/providers/storage.provider';

// Placeholder until a file storage is configured: posters only come from external URLs,
// so no movie entry ever holds an uploaded file to delete.
export class UnavailableStorageProvider implements IStorageProvider {
  upload(): Promise<IStoredFile> {
    return Promise.reject(new Error('File storage is not configured'));
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}
