import { v2 as cloudinary } from 'cloudinary';
import { Logger } from 'traceability';
import { IStorageProvider } from '../../../domain/common/providers/storage.provider';
import { CloudinaryStorageProvider } from '../../providers/storage/cloudinary.storage-provider';
import { env } from '../env';

export class StorageProviderFactory {
  static create(): IStorageProvider {
    if (
      !env.cloudinaryCloudName ||
      !env.cloudinaryApiKey ||
      !env.cloudinaryApiSecret
    ) {
      // The SDK rejects every call without credentials, and the provider turns that into a 503.
      Logger.warn('Cloudinary is not configured: uploads will fail', {
        eventName: 'cloudinary.not_configured',
      });
    }
    cloudinary.config({
      cloud_name: env.cloudinaryCloudName,
      api_key: env.cloudinaryApiKey,
      api_secret: env.cloudinaryApiSecret,
      secure: true,
    });
    return new CloudinaryStorageProvider(cloudinary.uploader);
  }
}
