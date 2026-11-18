import { Logger } from 'traceability';
import { IMovieCatalogProvider } from '../../../domain/common/providers/movie-catalog.provider';
import { TmdbMovieCatalogProvider } from '../../providers/movie-catalog/tmdb.movie-catalog-provider';
import { env } from '../env';

export class MovieCatalogProviderFactory {
  static create(): IMovieCatalogProvider {
    if (!env.tmdbAccessToken) {
      // TMDB answers 401 without a token, and the provider turns that into a 503.
      Logger.warn('TMDB is not configured: the movie search will fail', {
        eventName: 'tmdb.not_configured',
      });
    }
    return new TmdbMovieCatalogProvider({
      accessToken: env.tmdbAccessToken ?? '',
    });
  }
}
