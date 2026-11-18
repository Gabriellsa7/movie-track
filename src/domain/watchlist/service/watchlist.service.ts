import { Logger } from 'traceability';
import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IMAGE_MIME_TYPES } from '../../common/image.mime-types';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnprocessableEntityError } from '../../errors/unprocessable-entity.error';
import { IMovieEntryRepositoryRead } from '../../movie-entry/repository/movie-entry.repository.read';
import { ensureUserExists } from '../../user/ensure-user-exists';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IWatchlistItem } from '../interfaces/watchlist.interface';
import {
  IParamsAddWatchlistItem,
  IParamsListWatchlistItems,
  IParamsUpdateWatchlistItem,
  IParamsUploadWatchlistPoster,
  IParamsWatchlistService,
  IWatchlistService,
} from '../interfaces/watchlist.service.interface';
import { IWatchlistRepositoryRead } from '../repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../repository/watchlist.repository.write';
import { WatchlistItem } from '../watchlist.entity';

const MAX_GENRES = 5;
const POSTER_FOLDER = 'posters';

export class WatchlistService implements IWatchlistService {
  private watchlistRepositoryRead: IWatchlistRepositoryRead;
  private watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  private movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  private userRepositoryRead: IUserRepositoryRead;
  private genreRepositoryRead: IGenreRepositoryRead;
  private storageProvider: IStorageProvider;
  private clock: IClock;

  constructor({
    watchlistRepositoryRead,
    watchlistRepositoryWrite,
    movieEntryRepositoryRead,
    userRepositoryRead,
    genreRepositoryRead,
    storageProvider,
    clock,
  }: IParamsWatchlistService) {
    this.watchlistRepositoryRead = watchlistRepositoryRead;
    this.watchlistRepositoryWrite = watchlistRepositoryWrite;
    this.movieEntryRepositoryRead = movieEntryRepositoryRead;
    this.userRepositoryRead = userRepositoryRead;
    this.genreRepositoryRead = genreRepositoryRead;
    this.storageProvider = storageProvider;
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
      priority: params.priority,
      note: params.note,
      synopsis: params.synopsis,
      genreIds: params.genreIds,
      director: params.director,
      durationMinutes: params.durationMinutes,
      plannedFor: params.plannedFor,
      addedAt: now,
    });

    this.ensureValidReleaseYear(watchlistItem, now);
    await ensureUserExists(this.userRepositoryRead, params.userId);
    await this.ensureGenresExist(watchlistItem.genreIds);
    await this.ensureNotWatchedOrListed(watchlistItem);

    return this.watchlistRepositoryWrite.createWatchlistItem(watchlistItem);
  }

  @ErrorHandler()
  async updateWatchlistItem(
    params: IParamsUpdateWatchlistItem,
  ): Promise<IWatchlistItem> {
    const existingItem = await this.findExistingItem(params.id, params.userId);

    const watchlistItem = new WatchlistItem(existingItem);
    watchlistItem.updateDetails(params.itemData);
    this.ensureValidReleaseYear(watchlistItem, this.clock.now());
    await this.ensureGenresExist(watchlistItem.genreIds);

    // Only a change of title, year or tmdbId can turn the item into another movie.
    const sameMovieAsBefore =
      watchlistItem.normalizedTitle === existingItem.normalizedTitle &&
      watchlistItem.releaseYear === existingItem.releaseYear &&
      watchlistItem.tmdbId === existingItem.tmdbId;
    if (!sameMovieAsBefore) {
      await this.ensureNotWatchedOrListed(watchlistItem, params.id);
    }

    const updatedItem =
      await this.watchlistRepositoryWrite.updateWatchlistItemById(
        params.id,
        params.userId,
        {
          title: watchlistItem.title,
          normalizedTitle: watchlistItem.normalizedTitle,
          releaseYear: watchlistItem.releaseYear,
          tmdbId: watchlistItem.tmdbId,
          posterUrl: watchlistItem.posterUrl,
          posterPublicId: watchlistItem.posterPublicId,
          priority: watchlistItem.priority,
          note: watchlistItem.note,
          synopsis: watchlistItem.synopsis,
          genreIds: watchlistItem.genreIds,
          director: watchlistItem.director,
          durationMinutes: watchlistItem.durationMinutes,
          plannedFor: watchlistItem.plannedFor,
        },
      );
    if (!updatedItem) {
      throw this.watchlistItemNotFoundError();
    }
    await this.deleteReplacedPoster(existingItem, updatedItem);
    return updatedItem;
  }

  @ErrorHandler()
  async listWatchlistItems(
    params: IParamsListWatchlistItems,
  ): Promise<IPaginatedResult<IWatchlistItem>> {
    const { filter, sort, pagination } = params;
    const [items, total] = await Promise.all([
      this.watchlistRepositoryRead.listWatchlistItems(filter, sort, pagination),
      this.watchlistRepositoryRead.countWatchlistItems(filter),
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
      throw this.watchlistItemNotFoundError();
    }
    await this.deleteStoredPoster(deletedItem.posterPublicId);
  }

  @ErrorHandler()
  async uploadPoster(
    params: IParamsUploadWatchlistPoster,
  ): Promise<IWatchlistItem> {
    if (!IMAGE_MIME_TYPES.includes(params.mimeType)) {
      throw new UnprocessableEntityError(
        'poster must be a JPEG, PNG or WebP image',
        'INVALID_POSTER_TYPE',
      );
    }
    const existingItem = await this.findExistingItem(params.id, params.userId);
    const storedPoster = await this.storageProvider.upload({
      buffer: params.buffer,
      mimeType: params.mimeType,
      folder: POSTER_FOLDER,
    });

    let updatedItem: IWatchlistItem | null;
    try {
      updatedItem = await this.watchlistRepositoryWrite.updateWatchlistItemById(
        params.id,
        params.userId,
        { posterUrl: storedPoster.url, posterPublicId: storedPoster.publicId },
      );
    } catch (error) {
      await this.deleteStoredPoster(storedPoster.publicId);
      throw error;
    }
    // The item vanished meanwhile: do not leave an orphan file behind.
    if (!updatedItem) {
      await this.deleteStoredPoster(storedPoster.publicId);
      throw this.watchlistItemNotFoundError();
    }

    await this.deleteReplacedPoster(existingItem, updatedItem);
    return updatedItem;
  }

  @ErrorHandler()
  async removePoster(id: string, userId: string): Promise<IWatchlistItem> {
    const existingItem = await this.findExistingItem(id, userId);
    if (!existingItem.posterUrl) {
      return existingItem;
    }
    const updatedItem =
      await this.watchlistRepositoryWrite.updateWatchlistItemById(id, userId, {
        posterUrl: undefined,
        posterPublicId: undefined,
      });
    if (!updatedItem) {
      throw this.watchlistItemNotFoundError();
    }
    await this.deleteReplacedPoster(existingItem, updatedItem);
    return updatedItem;
  }

  private async findExistingItem(
    id: string,
    userId: string,
  ): Promise<IWatchlistItem> {
    const item = await this.watchlistRepositoryRead.findWatchlistItemById(
      id,
      userId,
    );
    if (!item) {
      throw this.watchlistItemNotFoundError();
    }
    return item;
  }

  private async deleteReplacedPoster(
    before: IWatchlistItem,
    after: IWatchlistItem,
  ): Promise<void> {
    if (
      before.posterPublicId &&
      before.posterPublicId !== after.posterPublicId
    ) {
      await this.deleteStoredPoster(before.posterPublicId);
    }
  }

  // The item is already saved; a storage failure only leaves an orphan file, so it must not fail the request.
  private async deleteStoredPoster(publicId: string | undefined): Promise<void> {
    if (!publicId) {
      return;
    }
    try {
      await this.storageProvider.delete(publicId);
    } catch (error) {
      Logger.warn('Failed to delete a poster from storage', {
        eventName: 'watchlist.poster.delete_failed',
        publicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // The lower bound (1888) is in the contract; the upper one moves with the clock.
  private ensureValidReleaseYear(watchlistItem: WatchlistItem, now: Date): void {
    if (
      watchlistItem.releaseYear !== undefined &&
      watchlistItem.releaseYear > now.getUTCFullYear() + 1
    ) {
      throw new UnprocessableEntityError(
        'releaseYear cannot be after next year',
        'INVALID_RELEASE_YEAR',
      );
    }
  }

  // Same rule as movies (1 to 5 from the list), so the item can later become a movie as is.
  private async ensureGenresExist(genreIds: string[] | undefined): Promise<void> {
    if (!genreIds) {
      return;
    }
    const genres = await this.genreRepositoryRead.findGenresByIds(genreIds);
    if (genreIds.length > MAX_GENRES || genres.length !== genreIds.length) {
      throw new UnprocessableEntityError(
        'Send from 1 to 5 genres from the genre list',
        'INVALID_GENRE',
      );
    }
  }

  private async ensureNotWatchedOrListed(
    watchlistItem: WatchlistItem,
    excludeId?: string,
  ): Promise<void> {
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
      await this.watchlistRepositoryRead.findDuplicateWatchlistItem({
        ...sameMovie,
        excludeId,
      });
    if (duplicate) {
      throw new ConflictError(
        'This movie is already in your watchlist',
        'ALREADY_IN_WATCHLIST',
      );
    }
  }

  private watchlistItemNotFoundError(): NotFoundError {
    return new NotFoundError(
      'Watchlist item not found',
      'WATCHLIST_ITEM_NOT_FOUND',
    );
  }
}
