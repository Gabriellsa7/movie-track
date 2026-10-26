import { v2 as cloudinary } from 'cloudinary';
import {
  IParamsUpload,
  IStorageProvider,
  IStoredFile,
} from '../../../domain/common/providers/storage.provider';

export type ICloudinaryUploader = Pick<
  typeof cloudinary.uploader,
  'upload' | 'destroy'
>;

export class CloudinaryStorageProvider implements IStorageProvider {
  private readonly uploader: ICloudinaryUploader;

  constructor(uploader: ICloudinaryUploader) {
    this.uploader = uploader;
  }

  async upload({
    buffer,
    mimeType,
    folder,
  }: IParamsUpload): Promise<IStoredFile> {
    // A data URI keeps the upload a single promise call instead of piping a stream.
    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const result = await this.uploader.upload(dataUri, {
      folder,
      resource_type: 'image',
    });
    return { url: result.secure_url, publicId: result.public_id };
  }

  async delete(publicId: string): Promise<void> {
    // invalidate purges the CDN cache, so the old poster stops being served right away.
    await this.uploader.destroy(publicId, {
      resource_type: 'image',
      invalidate: true,
    });
  }
}
