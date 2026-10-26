import { IMovieCatalogProvider } from '../../../domain/common/providers/movie-catalog.provider';
import { TmdbMovieCatalogProvider } from '../../providers/movie-catalog/tmdb.movie-catalog-provider';
import { env } from '../env';

export class MovieCatalogProviderFactory {
  static create(): IMovieCatalogProvider {
    return new TmdbMovieCatalogProvider({ accessToken: env.tmdbAccessToken });
  }
}
