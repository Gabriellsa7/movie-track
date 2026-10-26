import { v2 as cloudinary } from 'cloudinary';
import { IStorageProvider } from '../../../domain/common/providers/storage.provider';
import { CloudinaryStorageProvider } from '../../providers/storage/cloudinary.storage-provider';
import { env } from '../env';

export class StorageProviderFactory {
  static create(): IStorageProvider {
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    return new CloudinaryStorageProvider(cloudinary.uploader);
  }
}
