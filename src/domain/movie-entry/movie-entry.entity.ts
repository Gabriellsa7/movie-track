import { normalizeText } from '../common/text.normalizer';
import {
  IMovieEntry,
  IMovieEntryData,
  IMovieEntryDetailsData,
  IMovieEntryResponse,
  IParamsMovieEntry,
} from './interfaces/movie-entry.interface';

export class MovieEntry implements IMovieEntryData {
  _id?: string;

  userId: string;

  tmdbId?: number;

  title: string;

  normalizedTitle: string;

  synopsis: string;

  posterUrl?: string;

  posterPublicId?: string;

  releaseYear: number;

  genreIds: string[];

  director?: string;

  durationMinutes?: number;

  rating: number;

  review?: string;

  watchedAt: Date;

  isFavorite: boolean;

  createdAt: Date;

  updatedAt: Date;

  constructor(params: IParamsMovieEntry) {
    this.userId = params.userId;
    this.title = params.title.trim();
    this.normalizedTitle = normalizeText(params.title);
    this.synopsis = params.synopsis.trim();
    this.releaseYear = params.releaseYear;
    this.genreIds = [...new Set(params.genreIds)];
    this.rating = params.rating;
    this.createdAt = params.createdAt ?? new Date();
    this.updatedAt = params.updatedAt ?? this.createdAt;
    this.watchedAt = params.watchedAt ?? this.createdAt;
    this.isFavorite = params.isFavorite ?? false;

    if (params._id) {
      this._id = params._id;
    }

    if (params.tmdbId !== undefined) {
      this.tmdbId = params.tmdbId;
    }

    if (params.posterUrl) {
      this.posterUrl = params.posterUrl;
    }

    if (params.posterPublicId) {
      this.posterPublicId = params.posterPublicId;
    }

    if (params.director?.trim()) {
      this.director = params.director.trim();
    }

    if (params.durationMinutes !== undefined) {
      this.durationMinutes = params.durationMinutes;
    }

    if (params.review?.trim()) {
      this.review = params.review.trim();
    }
  }

  updateDetails(detailsData: IMovieEntryDetailsData, updatedAt: Date): void {
    if (detailsData.title !== undefined) {
      this.title = detailsData.title.trim();
      this.normalizedTitle = normalizeText(detailsData.title);
    }

    if (detailsData.synopsis !== undefined) {
      this.synopsis = detailsData.synopsis.trim();
    }

    if (detailsData.releaseYear !== undefined) {
      this.releaseYear = detailsData.releaseYear;
    }

    if (detailsData.genreIds !== undefined) {
      this.genreIds = [...new Set(detailsData.genreIds)];
    }

    if (detailsData.rating !== undefined) {
      this.rating = detailsData.rating;
    }

    if (detailsData.tmdbId !== undefined) {
      this.tmdbId = detailsData.tmdbId;
    }

    if (detailsData.director !== undefined) {
      this.director = detailsData.director.trim() || undefined;
    }

    if (detailsData.durationMinutes !== undefined) {
      this.durationMinutes = detailsData.durationMinutes;
    }

    if (detailsData.review !== undefined) {
      this.review = detailsData.review.trim() || undefined;
    }

    if (detailsData.watchedAt !== undefined) {
      this.watchedAt = detailsData.watchedAt;
    }

    if (detailsData.isFavorite !== undefined) {
      this.isFavorite = detailsData.isFavorite;
    }

    this.updatedAt = updatedAt;
  }

  setFavorite(isFavorite: boolean, updatedAt: Date): void {
    this.isFavorite = isFavorite;
    this.updatedAt = updatedAt;
  }

  // posterPublicId is absent for an external URL: only uploaded posters live in our storage.
  changePoster(
    posterUrl: string,
    posterPublicId: string | undefined,
    updatedAt: Date,
  ): void {
    this.posterUrl = posterUrl;
    this.posterPublicId = posterPublicId;
    this.updatedAt = updatedAt;
  }

  removePoster(updatedAt: Date): void {
    this.posterUrl = undefined;
    this.posterPublicId = undefined;
    this.updatedAt = updatedAt;
  }

  public static toMovieEntryResponse(data: IMovieEntry): IMovieEntryResponse {
    const { _id, normalizedTitle, posterPublicId, ...movieEntry } = data;

    return { id: _id, ...movieEntry };
  }
}
