import {
  Router,
  Request,
  Response,
  NextFunction,
  RequestHandler,
} from 'express';
import { IController } from './controller.interface';
import { IWatchlistService } from '../../../domain/watchlist/interfaces/watchlist.service.interface';
import { WatchlistItem } from '../../../domain/watchlist/watchlist.entity';
import {
  EWatchlistPriority,
  EWatchlistSortField,
} from '../../../domain/watchlist/interfaces/watchlist.interface';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 20;

interface IListWatchlistQuery {
  search?: string;
  priority?: EWatchlistPriority;
  planned?: boolean;
  sort?: EWatchlistSortField;
  page?: number;
  limit?: number;
}

export class WatchlistController implements IController {
  router: Router;
  private readonly watchlistService: IWatchlistService;
  private readonly authenticate: RequestHandler;

  constructor(
    watchlistService: IWatchlistService,
    authenticate: RequestHandler,
  ) {
    this.watchlistService = watchlistService;
    this.authenticate = authenticate;
    this.router = Router();
    this.initRoutes();
  }

  initRoutes() {
    this.router.post('/watchlist', this.authenticate, this.addWatchlistItem);
    this.router.get('/watchlist', this.authenticate, this.listWatchlistItems);
    this.router.put(
      '/watchlist/:id',
      this.authenticate,
      this.updateWatchlistItem,
    );
    this.router.delete(
      '/watchlist/:id',
      this.authenticate,
      this.removeWatchlistItem,
    );
  }

  addWatchlistItem = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { plannedFor, ...itemData } = req.body;
    try {
      const watchlistItem = await this.watchlistService.addWatchlistItem({
        ...itemData,
        plannedFor: plannedFor ? new Date(plannedFor) : undefined,
        userId: req.userId!,
      });
      res
        .status(201)
        .json(WatchlistItem.toWatchlistItemResponse(watchlistItem));
    } catch (error) {
      next(error);
    }
  };

  listWatchlistItems = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const {
      search,
      priority,
      planned,
      sort = EWatchlistSortField.ADDED_AT,
      page = DEFAULT_PAGE,
      limit = DEFAULT_PAGE_LIMIT,
    } = req.query as IListWatchlistQuery;
    try {
      const result = await this.watchlistService.listWatchlistItems({
        filter: { userId: req.userId!, search, priority, planned },
        sort,
        pagination: { limit, offset: (page - 1) * limit },
      });
      res.status(200).json({
        ...result,
        items: result.items.map(WatchlistItem.toWatchlistItemResponse),
      });
    } catch (error) {
      next(error);
    }
  };

  updateWatchlistItem = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { plannedFor, ...itemData } = req.body;
    try {
      const watchlistItem = await this.watchlistService.updateWatchlistItem({
        id: req.params.id,
        userId: req.userId!,
        itemData: {
          ...itemData,
          ...(plannedFor !== undefined && {
            plannedFor: plannedFor === null ? null : new Date(plannedFor),
          }),
        },
      });
      res
        .status(200)
        .json(WatchlistItem.toWatchlistItemResponse(watchlistItem));
    } catch (error) {
      next(error);
    }
  };

  removeWatchlistItem = async (
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.watchlistService.removeWatchlistItem(
        req.params.id,
        req.userId!,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  public getRoutes(): Router {
    return this.router;
  }
}
