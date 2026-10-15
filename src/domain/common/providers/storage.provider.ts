export interface IParamsUpload {
  buffer: Buffer;
  mimeType: string;
  folder: string;
}

export interface IStoredFile {
  url: string;
  publicId: string;
}

export interface IStorageProvider {
  upload(params: IParamsUpload): Promise<IStoredFile>;
  delete(publicId: string): Promise<void>;
}
