import { Request } from 'express';
import { BadRequest } from 'express-openapi-validator/dist/framework/types';

// The validator lets a text field with the file's name through, so the file itself must be checked.
export function getUploadedFile(
  req: Request,
  fieldName: string,
): Express.Multer.File | BadRequest {
  const file = (req.files as Express.Multer.File[] | undefined)?.find(
    (uploadedFile) => uploadedFile.fieldname === fieldName,
  );
  return (
    file ??
    new BadRequest({ path: `.body.${fieldName}`, message: 'should be a file' })
  );
}
