import { v2 as cloudinary } from 'cloudinary';
import { Logger } from 'traceability';
import {
  IParamsUpload,
  IStorageProvider,
  IStoredFile,
} from '../../../domain/common/providers/storage.provider';
import { ServiceUnavailableError } from '../../../domain/errors/service-unavailable.error';

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
    try {
      const result = await this.uploader.upload(dataUri, {
        folder,
        resource_type: 'image',
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      throw this.unavailableError('upload', error);
    }
  }

  async delete(publicId: string): Promise<void> {
    try {
      // invalidate purges the CDN cache, so the old poster stops being served right away.
      await this.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
    } catch (error) {
      throw this.unavailableError('delete', error, publicId);
    }
  }

  // The SDK rejects with plain objects ({ message, http_code }), which log as "[object Object]";
  // the details go to the log and the client gets a 503 in the contract shape.
  private unavailableError(
    operation: 'upload' | 'delete',
    error: unknown,
    publicId?: string,
  ): ServiceUnavailableError {
    const { message, http_code: httpCode } = (error ?? {}) as {
      message?: unknown;
      http_code?: unknown;
    };
    Logger.warn('Cloudinary request failed', {
      eventName: 'cloudinary.request_failed',
      operation,
      ...(publicId && { publicId }),
      error: typeof message === 'string' ? message : String(error),
      ...(typeof httpCode === 'number' && { httpCode }),
    });
    return new ServiceUnavailableError(
      'File storage unavailable',
      'STORAGE_UNAVAILABLE',
    );
  }
}
