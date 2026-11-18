import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { IController } from './controller.interface';
import { IMovieSearchService } from '../../../domain/movie-search/interfaces/movie-search.service.interface';

const DEFAULT_PAGE = 1;

interface ISearchMoviesQuery {
  query: string;
  page?: number;
}

export class MovieSearchController implements IController {
  router: Router;
  private readonly movieSearchService: IMovieSearchService;
  private readonly authenticate: RequestHandler;

  constructor(
    movieSearchService: IMovieSearchService,
    authenticate: RequestHandler,
  ) {
    this.movieSearchService = movieSearchService;
    this.authenticate = authenticate;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.get('/tmdb/search', this.authenticate, this.searchMovies);
    this.router.get(
      '/tmdb/movies/:tmdbId',
      this.authenticate,
      this.getMovieDetails,
    );
  }

  getMovieDetails = async (
    req: Request<{ tmdbId: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const details = await this.movieSearchService.getMovieDetails(
        Number(req.params.tmdbId),
        req.language,
      );
      res.status(200).json(details);
    } catch (error) {
      next(error);
    }
  };

  searchMovies = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { query, page = DEFAULT_PAGE } =
      req.query as unknown as ISearchMoviesQuery;
    try {
      const result = await this.movieSearchService.searchMovies({
        query,
        page,
        language: req.language,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  public getRoutes(): Router {
    return this.router;
  }
}
