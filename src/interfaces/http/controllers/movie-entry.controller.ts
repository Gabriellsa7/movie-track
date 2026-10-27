import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { IController } from './controller.interface';
import {
  EMovieEntrySortField,
  ESortOrder,
} from '../../../domain/movie-entry/interfaces/movie-entry.interface';
import { IMovieEntryService } from '../../../domain/movie-entry/interfaces/movie-entry.service.interface';
import { MovieEntry } from '../../../domain/movie-entry/movie-entry.entity';
import { authorizeSelf } from '../middlewares/auth.middleware';
import { getUploadedFile } from './uploaded-file.helper';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 20;
const POSTER_FIELD = 'poster';

interface IListMovieEntriesQuery {
  search?: string;
  genreId?: string;
  minRating?: number;
  maxRating?: number;
  favorite?: boolean;
  sort?: EMovieEntrySortField;
  order?: ESortOrder;
  page?: number;
  limit?: number;
}

export class MovieEntryController implements IController {
  router: Router;
  private readonly movieEntryService: IMovieEntryService;
  private readonly authenticate: RequestHandler;

  constructor(
    movieEntryService: IMovieEntryService,
    authenticate: RequestHandler,
  ) {
    this.movieEntryService = movieEntryService;
    this.authenticate = authenticate;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.post('/movies', this.authenticate, this.createMovieEntry);
    this.router.get('/movies', this.authenticate, this.listMovieEntries);
    this.router.get('/movies/:id', this.authenticate, this.getMovieEntry);
    this.router.put('/movies/:id', this.authenticate, this.updateMovieEntry);
    this.router.post(
      '/movies/:id/rewatch',
      this.authenticate,
      this.rewatchMovieEntry,
    );
    this.router.patch(
      '/movies/:id/favorite',
      this.authenticate,
      this.setFavorite,
    );
    this.router.delete('/movies/:id', this.authenticate, this.deleteMovieEntry);
    this.router.put('/movies/:id/poster', this.authenticate, this.uploadPoster);
    this.router.delete(
      '/movies/:id/poster',
      this.authenticate,
      this.removePoster,
    );
    // Under /users because /movies/stats would be taken by /movies/:id.
    this.router.get(
      '/users/:id/stats',
      this.authenticate,
      authorizeSelf,
      this.getUserStats,
    );
  }

  createMovieEntry = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { watchedAt, ...movieData } = req.body;
    try {
      const movieEntry = await this.movieEntryService.createMovieEntry({
        ...movieData,
        watchedAt: watchedAt ? new Date(watchedAt) : undefined,
        userId: req.userId!,
      });
      res.status(201).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  listMovieEntries = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const {
      search,
      genreId,
      minRating,
      maxRating,
      favorite,
      sort = EMovieEntrySortField.WATCHED_AT,
      order = ESortOrder.DESC,
      page = DEFAULT_PAGE,
      limit = DEFAULT_PAGE_LIMIT,
    } = req.query as IListMovieEntriesQuery;
    try {
      const result = await this.movieEntryService.listMovieEntries({
        filter: {
          userId: req.userId!,
          search,
          genreId,
          minRating,
          maxRating,
          favorite,
        },
        sort: { field: sort, order },
        pagination: { limit, offset: (page - 1) * limit },
      });
      res.status(200).json({
        ...result,
        items: result.items.map(MovieEntry.toMovieEntryResponse),
      });
    } catch (error) {
      next(error);
    }
  };

  getMovieEntry = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const movieEntry = await this.movieEntryService.getMovieEntryById(
        req.params.id,
        req.userId!,
      );
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  updateMovieEntry = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { watchedAt, ...movieData } = req.body;
    try {
      const movieEntry = await this.movieEntryService.updateMovieEntry({
        id: req.params.id,
        userId: req.userId!,
        movieData: {
          ...movieData,
          watchedAt: watchedAt ? new Date(watchedAt) : undefined,
        },
      });
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  rewatchMovieEntry = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const watchedAt = req.body?.watchedAt;
    try {
      const movieEntry = await this.movieEntryService.rewatchMovieEntry({
        id: req.params.id,
        userId: req.userId!,
        watchedAt: watchedAt ? new Date(watchedAt) : undefined,
      });
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  setFavorite = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const movieEntry = await this.movieEntryService.setFavorite({
        id: req.params.id,
        userId: req.userId!,
        isFavorite: req.body.isFavorite,
      });
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  deleteMovieEntry = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.movieEntryService.deleteMovieEntry(req.params.id, req.userId!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  uploadPoster = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const poster = getUploadedFile(req, POSTER_FIELD);
    if (poster instanceof Error) {
      next(poster);
      return;
    }
    try {
      const movieEntry = await this.movieEntryService.uploadPoster({
        id: req.params.id,
        userId: req.userId!,
        buffer: poster.buffer,
        mimeType: poster.mimetype,
      });
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  removePoster = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const movieEntry = await this.movieEntryService.removePoster(
        req.params.id,
        req.userId!,
      );
      res.status(200).json(MovieEntry.toMovieEntryResponse(movieEntry));
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const stats = await this.movieEntryService.getUserStats(req.userId!);
      res.status(200).json(stats);
    } catch (error) {
      next(error);
    }
  };

  public getRoutes(): Router {
    return this.router;
  }
}
