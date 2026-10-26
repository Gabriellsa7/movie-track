import { MovieSearchService } from '../../../domain/movie-search/service/movie-search.service';
import { GenreRepositoryRead } from '../../repository/genre/genre.repository.read';
import { MovieCatalogProviderFactory } from './movie-catalog.provider.factory';

export class MovieSearchServiceFactory {
  static create() {
    return new MovieSearchService({
      movieCatalogProvider: MovieCatalogProviderFactory.create(),
      genreRepositoryRead: new GenreRepositoryRead(),
    });
  }
}
