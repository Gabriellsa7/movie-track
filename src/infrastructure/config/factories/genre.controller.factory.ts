import { GenreController } from '../../../interfaces/http/controllers/genre.controller';
import { IController } from '../../../interfaces/http/controllers/controller.interface';
import { GenreServiceFactory } from './genre.service.factory';

export class GenreControllerFactory {
  static create(): IController {
    return new GenreController(GenreServiceFactory.create());
  }
}
