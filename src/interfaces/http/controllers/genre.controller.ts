import { Router, Request, Response, NextFunction } from 'express';
import { IController } from './controller.interface';
import { IGenreService } from '../../../domain/genre/interfaces/genre.service.interface';

export class GenreController implements IController {
  router: Router;
  private readonly genreService: IGenreService;

  constructor(genreService: IGenreService) {
    this.genreService = genreService;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.get('/genres', this.listGenres);
  }

  listGenres = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const genres = await this.genreService.listGenres();
      res.status(200).json(genres);
    } catch (error) {
      next(error);
    }
  };

  public getRoutes(): Router {
    return this.router;
  }
}
