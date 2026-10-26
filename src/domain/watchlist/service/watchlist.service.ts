import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnprocessableEntityError } from '../../errors/unprocessable-entity.error';
import { IMovieEntryRepositoryRead } from '../../movie-entry/repository/movie-entry.repository.read';
import { IWatchlistItem } from '../interfaces/watchlist.interface';
import {
  IParamsAddWatchlistItem,
  IParamsListWatchlistItems,
  IParamsWatchlistService,
  IWatchlistService,
} from '../interfaces/watchlist.service.interface';
import { IWatchlistRepositoryRead } from '../repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../repository/watchlist.repository.write';
import { WatchlistItem } from '../watchlist.entity';

export class WatchlistService implements IWatchlistService {
  private watchlistRepositoryRead: IWatchlistRepositoryRead;
  private watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  private movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  private clock: IClock;

  constructor({
    watchlistRepositoryRead,
    watchlistRepositoryWrite,
    movieEntryRepositoryRead,
    clock,
  }: IParamsWatchlistService) {
    this.watchlistRepositoryRead = watchlistRepositoryRead;
    this.watchlistRepositoryWrite = watchlistRepositoryWrite;
    this.movieEntryRepositoryRead = movieEntryRepositoryRead;
    this.clock = clock;
  }

  @ErrorHandler()
  async addWatchlistItem(
    params: IParamsAddWatchlistItem,
  ): Promise<IWatchlistItem> {
    const now = this.clock.now();
    const watchlistItem = new WatchlistItem({
      userId: params.userId,
      title: params.title,
      tmdbId: params.tmdbId,
      posterUrl: params.posterUrl,
      releaseYear: params.releaseYear,
      addedAt: now,
    });

    // The lower bound (1888) is in the contract; the upper one moves with the clock.
    if (
      watchlistItem.releaseYear !== undefined &&
      watchlistItem.releaseYear > now.getUTCFullYear() + 1
    ) {
      throw new UnprocessableEntityError(
        'releaseYear cannot be after next year',
        'INVALID_RELEASE_YEAR',
      );
    }

    const sameMovie = {
      userId: watchlistItem.userId,
      tmdbId: watchlistItem.tmdbId,
      normalizedTitle: watchlistItem.normalizedTitle,
      releaseYear: watchlistItem.releaseYear,
    };
    const loggedMovie =
      await this.movieEntryRepositoryRead.findDuplicateMovieEntry(sameMovie);
    if (loggedMovie) {
      throw new ConflictError(
        'You have already watched this movie',
        'MOVIE_ALREADY_LOGGED',
      );
    }

    const duplicate =
      await this.watchlistRepositoryRead.findDuplicateWatchlistItem(sameMovie);
    if (duplicate) {
      throw new ConflictError(
        'This movie is already in your watchlist',
        'ALREADY_IN_WATCHLIST',
      );
    }

    return this.watchlistRepositoryWrite.createWatchlistItem(watchlistItem);
  }

  @ErrorHandler()
  async listWatchlistItems(
    params: IParamsListWatchlistItems,
  ): Promise<IPaginatedResult<IWatchlistItem>> {
    const { userId, search, pagination } = params;
    const [items, total] = await Promise.all([
      this.watchlistRepositoryRead.listWatchlistItems(
        userId,
        search,
        pagination,
      ),
      this.watchlistRepositoryRead.countWatchlistItems(userId, search),
    ]);
    return {
      items,
      total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      limit: pagination.limit,
    };
  }

  @ErrorHandler()
  async removeWatchlistItem(id: string, userId: string): Promise<void> {
    const deletedItem =
      await this.watchlistRepositoryWrite.deleteWatchlistItemById(id, userId);
    if (!deletedItem) {
      throw new NotFoundError(
        'Watchlist item not found',
        'WATCHLIST_ITEM_NOT_FOUND',
      );
    }
  }
}
