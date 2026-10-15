import {
  EMovieEntrySortField,
  ESortOrder,
} from '../../domain/movie-entry/interfaces/movie-entry.interface';

describe('When we read the movie entry list enums', () => {
  it('should expose the sort fields accepted by the list query', () => {
    expect(Object.values(EMovieEntrySortField)).toEqual([
      'watchedAt',
      'rating',
      'title',
      'releaseYear',
    ]);
  });

  it('should expose the sort orders accepted by the list query', () => {
    expect(Object.values(ESortOrder)).toEqual(['asc', 'desc']);
  });
});
