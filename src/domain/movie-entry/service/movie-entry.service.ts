import { Logger } from 'traceability';
import { ErrorHandler } from '../../common/decorators/error-handler.decorator';
import { IMAGE_MIME_TYPES } from '../../common/image.mime-types';
import { IPaginatedResult } from '../../common/pagination.interface';
import { IClock } from '../../common/providers/clock.provider';
import { IStorageProvider } from '../../common/providers/storage.provider';
import { ConflictError } from '../../errors/conflict.error';
import { NotFoundError } from '../../errors/not-found.error';
import { UnprocessableEntityError } from '../../errors/unprocessable-entity.error';
import { IGenreRepositoryRead } from '../../genre/repository/genre.repository.read';
import { ensureUserExists } from '../../user/ensure-user-exists';
import { IUserRepositoryRead } from '../../user/repository/user.repository.read';
import { IWatchlistRepositoryRead } from '../../watchlist/repository/watchlist.repository.read';
import { IWatchlistRepositoryWrite } from '../../watchlist/repository/watchlist.repository.write';
import {
  IMovieEntry,
  IMovieEntryData,
  IUserStats,
} from '../interfaces/movie-entry.interface';
import {
  IMovieEntryService,
  IParamsCreateMovieEntry,
  IParamsListMovieEntries,
  IParamsMovieEntryService,
  IParamsSetFavorite,
  IParamsUpdateMovieEntry,
  IParamsUploadPoster,
} from '../interfaces/movie-entry.service.interface';
import { MovieEntry } from '../movie-entry.entity';
import { IMovieEntryRepositoryRead } from '../repository/movie-entry.repository.read';
import { IMovieEntryRepositoryWrite } from '../repository/movie-entry.repository.write';

const POSTER_FOLDER = 'posters';
const STATS_MONTHS = 12;
const MIN_RATING = 1;
const MAX_RATING = 10;
const RATING_STEP = 0.5;
const MIN_GENRES = 1;
const MAX_GENRES = 5;

export class MovieEntryService implements IMovieEntryService {
  private movieEntryRepositoryRead: IMovieEntryRepositoryRead;
  private movieEntryRepositoryWrite: IMovieEntryRepositoryWrite;
  private genreRepositoryRead: IGenreRepositoryRead;
  private watchlistRepositoryRead: IWatchlistRepositoryRead;
  private watchlistRepositoryWrite: IWatchlistRepositoryWrite;
  private userRepositoryRead: IUserRepositoryRead;
  private storageProvider: IStorageProvider;
  private clock: IClock;

  constructor({
    clock,
    genreRepositoryRead,
    movieEntryRepositoryRead,
    movieEntryRepositoryWrite,
    watchlistRepositoryRead,
    watchlistRepositoryWrite,
    userRepositoryRead,
    storageProvider,
  }: IParamsMovieEntryService) {
    this.movieEntryRepositoryRead = movieEntryRepositoryRead;
    this.movieEntryRepositoryWrite = movieEntryRepositoryWrite;
    this.genreRepositoryRead = genreRepositoryRead;
    this.watchlistRepositoryRead = watchlistRepositoryRead;
    this.watchlistRepositoryWrite = watchlistRepositoryWrite;
    this.userRepositoryRead = userRepositoryRead;
    this.storageProvider = storageProvider;
    this.clock = clock;
  }

  @ErrorHandler()
  async createMovieEntry(
    params: IParamsCreateMovieEntry,
  ): Promise<IMovieEntry> {
    const movieEntry = new MovieEntry({
      userId: params.userId,
      title: params.title,
      synopsis: params.synopsis,
      releaseYear: params.releaseYear,
      genreIds: params.genreIds,
      rating: params.rating,
      review: params.review,
      posterUrl: params.posterUrl,
      director: params.director,
      durationMinutes: params.durationMinutes,
      watchedAt: params.watchedAt,
      isFavorite: params.isFavorite,
      tmdbId: params.tmdbId,
      createdAt: this.clock.now(),
    });

    this.ensureValidMovieEntry(movieEntry, movieEntry.createdAt);
    await ensureUserExists(this.userRepositoryRead, params.userId);
    await this.ensureGenresExist(movieEntry.genreIds);
    await this.ensureNotDuplicate(movieEntry);
    if (params.watchlistItemId) {
      await this.ensureWatchlistItemExists(
        params.watchlistItemId,
        params.userId,
      );
    }

    const createdMovieEntry =
      await this.movieEntryRepositoryWrite.createMovieEntry(movieEntry);

    // Logging a movie from the watchlist means it has been watched.
    if (params.watchlistItemId) {
      await this.watchlistRepositoryWrite.deleteWatchlistItemById(
        params.watchlistItemId,
        params.userId,
      );
    }

    return createdMovieEntry;
  }

  @ErrorHandler()
  async getMovieEntryById(id: string, userId: string): Promise<IMovieEntry> {
    return this.findExistingMovieEntry(id, userId);
  }

  @ErrorHandler()
  async listMovieEntries(
    params: IParamsListMovieEntries,
  ): Promise<IPaginatedResult<IMovieEntry>> {
    const { filter, sort, pagination } = params;
    if (
      filter.minRating !== undefined &&
      filter.maxRating !== undefined &&
      filter.minRating > filter.maxRating
    ) {
      throw new UnprocessableEntityError(
        'minRating must not be greater than maxRating',
        'INVALID_RATING_RANGE',
      );
    }
    if (filter.genreId !== undefined) {
      await this.ensureGenresExist([filter.genreId]);
    }

    const [items, total] = await Promise.all([
      this.movieEntryRepositoryRead.listMovieEntries(filter, sort, pagination),
      this.movieEntryRepositoryRead.countMovieEntries(filter),
    ]);
    return {
      items,
      total,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
      limit: pagination.limit,
    };
  }

  @ErrorHandler()
  async updateMovieEntry(params: IParamsUpdateMovieEntry): Promise<IMovieEntry> {
    const { posterUrl, ...detailsData } = params.movieData;
    const existingMovieEntry = await this.findExistingMovieEntry(
      params.id,
      params.userId,
    );
    const movieEntry = new MovieEntry(existingMovieEntry);
    const now = this.clock.now();

    movieEntry.updateDetails(detailsData, now);
    if (posterUrl === null) {
      movieEntry.removePoster(now);
    } else if (
      posterUrl !== undefined &&
      posterUrl !== existingMovieEntry.posterUrl
    ) {
      movieEntry.changePoster(posterUrl, undefined, now);
    }

    this.ensureValidMovieEntry(movieEntry, now);
    await this.ensureGenresExist(movieEntry.genreIds);
    await this.ensureNotDuplicate(movieEntry, params.id);

    const updatedMovieEntry = await this.saveMovieEntry(
      params.id,
      params.userId,
      movieEntry,
    );
    await this.deleteReplacedPoster(existingMovieEntry, updatedMovieEntry);
    return updatedMovieEntry;
  }

  @ErrorHandler()
  async setFavorite(params: IParamsSetFavorite): Promise<IMovieEntry> {
    const movieEntry = new MovieEntry(
      await this.findExistingMovieEntry(params.id, params.userId),
    );
    movieEntry.setFavorite(params.isFavorite, this.clock.now());

    return this.saveMovieEntry(params.id, params.userId, movieEntry);
  }

  @ErrorHandler()
  async deleteMovieEntry(id: string, userId: string): Promise<void> {
    const deletedMovieEntry =
      await this.movieEntryRepositoryWrite.deleteMovieEntryById(id, userId);
    if (!deletedMovieEntry) {
      throw this.movieEntryNotFoundError();
    }
    await this.deleteStoredPoster(deletedMovieEntry.posterPublicId);
  }

  @ErrorHandler()
  async uploadPoster(params: IParamsUploadPoster): Promise<IMovieEntry> {
    if (!IMAGE_MIME_TYPES.includes(params.mimeType)) {
      throw new UnprocessableEntityError(
        'poster must be a JPEG, PNG or WebP image',
        'INVALID_POSTER_TYPE',
      );
    }
    const existingMovieEntry = await this.findExistingMovieEntry(
      params.id,
      params.userId,
    );
    const storedPoster = await this.storageProvider.upload({
      buffer: params.buffer,
      mimeType: params.mimeType,
      folder: POSTER_FOLDER,
    });

    const movieEntry = new MovieEntry(existingMovieEntry);
    movieEntry.changePoster(
      storedPoster.url,
      storedPoster.publicId,
      this.clock.now(),
    );

    let updatedMovieEntry: IMovieEntry;
    try {
      updatedMovieEntry = await this.saveMovieEntry(
        params.id,
        params.userId,
        movieEntry,
      );
    } catch (error) {
      // The entry vanished (or the write failed): do not leave an orphan file behind.
      await this.deleteStoredPoster(storedPoster.publicId);
      throw error;
    }

    await this.deleteReplacedPoster(existingMovieEntry, updatedMovieEntry);
    return updatedMovieEntry;
  }

  @ErrorHandler()
  async removePoster(id: string, userId: string): Promise<IMovieEntry> {
    const existingMovieEntry = await this.findExistingMovieEntry(id, userId);
    if (!existingMovieEntry.posterUrl) {
      return existingMovieEntry;
    }
    const movieEntry = new MovieEntry(existingMovieEntry);
    movieEntry.removePoster(this.clock.now());

    const updatedMovieEntry = await this.saveMovieEntry(id, userId, movieEntry);
    await this.deleteReplacedPoster(existingMovieEntry, updatedMovieEntry);
    return updatedMovieEntry;
  }

  @ErrorHandler()
  async getUserStats(userId: string): Promise<IUserStats> {
    const now = this.clock.now();
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (STATS_MONTHS - 1), 1),
    );
    return this.movieEntryRepositoryRead.getUserStats(userId, since);
  }

  private async findExistingMovieEntry(
    id: string,
    userId: string,
  ): Promise<IMovieEntry> {
    const movieEntry = await this.movieEntryRepositoryRead.findMovieEntryById(
      id,
      userId,
    );
    if (!movieEntry) {
      throw this.movieEntryNotFoundError();
    }
    return movieEntry;
  }

  private async saveMovieEntry(
    id: string,
    userId: string,
    movieEntry: MovieEntry,
  ): Promise<IMovieEntry> {
    const updatedMovieEntry =
      await this.movieEntryRepositoryWrite.updateMovieEntryById(
        id,
        userId,
        this.toUpdateData(movieEntry),
      );
    if (!updatedMovieEntry) {
      throw this.movieEntryNotFoundError();
    }
    return updatedMovieEntry;
  }

  // Optional fields are listed explicitly so a cleared value (undefined) is removed from the document.
  private toUpdateData(
    movieEntry: MovieEntry,
  ): Partial<Omit<IMovieEntryData, 'userId' | 'createdAt'>> {
    return {
      tmdbId: movieEntry.tmdbId,
      title: movieEntry.title,
      normalizedTitle: movieEntry.normalizedTitle,
      synopsis: movieEntry.synopsis,
      posterUrl: movieEntry.posterUrl,
      posterPublicId: movieEntry.posterPublicId,
      releaseYear: movieEntry.releaseYear,
      genreIds: movieEntry.genreIds,
      director: movieEntry.director,
      durationMinutes: movieEntry.durationMinutes,
      rating: movieEntry.rating,
      review: movieEntry.review,
      watchedAt: movieEntry.watchedAt,
      isFavorite: movieEntry.isFavorite,
      updatedAt: movieEntry.updatedAt,
    };
  }

  private ensureValidMovieEntry(movieEntry: MovieEntry, now: Date): void {
    const { rating } = movieEntry;
    if (
      rating < MIN_RATING ||
      rating > MAX_RATING ||
      !Number.isInteger(rating / RATING_STEP)
    ) {
      throw new UnprocessableEntityError(
        'rating must be between 1 and 10 in steps of 0.5',
        'INVALID_RATING',
      );
    }
    // The lower bound (1888) is in the contract; the upper one moves with the clock.
    if (movieEntry.releaseYear > now.getUTCFullYear() + 1) {
      throw new UnprocessableEntityError(
        'releaseYear cannot be after next year',
        'INVALID_RELEASE_YEAR',
      );
    }
    if (movieEntry.watchedAt > now) {
      throw new UnprocessableEntityError(
        'watchedAt cannot be in the future',
        'INVALID_WATCHED_AT',
      );
    }
    if (
      movieEntry.genreIds.length < MIN_GENRES ||
      movieEntry.genreIds.length > MAX_GENRES
    ) {
      throw this.invalidGenreError();
    }
  }

  private async ensureGenresExist(genreIds: string[]): Promise<void> {
    const genres = await this.genreRepositoryRead.findGenresByIds(genreIds);
    if (genres.length !== genreIds.length) {
      throw this.invalidGenreError();
    }
  }

  private async ensureNotDuplicate(
    movieEntry: MovieEntry,
    excludeId?: string,
  ): Promise<void> {
    const duplicate = await this.movieEntryRepositoryRead.findDuplicateMovieEntry(
      {
        userId: movieEntry.userId,
        tmdbId: movieEntry.tmdbId,
        normalizedTitle: movieEntry.normalizedTitle,
        releaseYear: movieEntry.releaseYear,
        excludeId,
      },
    );
    if (duplicate) {
      throw new ConflictError(
        'This movie is already in your list',
        'MOVIE_ALREADY_LOGGED',
      );
    }
  }

  private async ensureWatchlistItemExists(
    watchlistItemId: string,
    userId: string,
  ): Promise<void> {
    const watchlistItem =
      await this.watchlistRepositoryRead.findWatchlistItemById(
        watchlistItemId,
        userId,
      );
    if (!watchlistItem) {
      throw new NotFoundError(
        'Watchlist item not found',
        'WATCHLIST_ITEM_NOT_FOUND',
      );
    }
  }

  private async deleteReplacedPoster(
    before: IMovieEntry,
    after: IMovieEntry,
  ): Promise<void> {
    if (
      before.posterPublicId &&
      before.posterPublicId !== after.posterPublicId
    ) {
      await this.deleteStoredPoster(before.posterPublicId);
    }
  }

  // The entry is already saved; a storage failure only leaves an orphan file, so it must not fail the request.
  private async deleteStoredPoster(publicId: string | undefined): Promise<void> {
    if (!publicId) {
      return;
    }
    try {
      await this.storageProvider.delete(publicId);
    } catch (error) {
      Logger.warn('Failed to delete a poster from storage', {
        eventName: 'movie-entry.poster.delete_failed',
        publicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private movieEntryNotFoundError(): NotFoundError {
    return new NotFoundError('Movie not found', 'MOVIE_NOT_FOUND');
  }

  private invalidGenreError(): UnprocessableEntityError {
    return new UnprocessableEntityError(
      'Send from 1 to 5 genres from the genre list',
      'INVALID_GENRE',
    );
  }
}
