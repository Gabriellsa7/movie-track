import { IMovieEntry } from '../../domain/movie-entry/interfaces/movie-entry.interface';
import { MovieEntry } from '../../domain/movie-entry/movie-entry.entity';

const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-02-01T00:00:00.000Z');

const A_MOVIE_ENTRY: IMovieEntry = {
  _id: 'entry-1',
  userId: 'user-1',
  title: 'The Matrix',
  normalizedTitle: 'the matrix',
  synopsis: 'A hacker learns the truth.',
  posterUrl: 'https://cdn.example.com/poster.png',
  posterPublicId: 'posters/1',
  releaseYear: 1999,
  genreIds: ['genre-1'],
  director: 'Wachowskis',
  rating: 5,
  review: 'Great',
  watchedAt: CREATED_AT,
  isFavorite: false,
  watchCount: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

describe('When we create a movie entry entity', () => {
  it('should normalize fields, apply defaults and leave the id to the database', () => {
    const movieEntry = new MovieEntry({
      userId: 'user-1',
      title: '  Amélie  ',
      synopsis: ' A girl in Paris. ',
      releaseYear: 2001,
      genreIds: ['genre-1', 'genre-1'],
      rating: 4,
      director: '   ',
      review: '  ',
      createdAt: CREATED_AT,
    });

    expect(movieEntry).toMatchObject({
      title: 'Amélie',
      normalizedTitle: 'amelie',
      synopsis: 'A girl in Paris.',
      genreIds: ['genre-1'],
      isFavorite: false,
      watchedAt: CREATED_AT,
      updatedAt: CREATED_AT,
    });
    expect(movieEntry).not.toHaveProperty('_id');
    expect(movieEntry).not.toHaveProperty('director');
    expect(movieEntry).not.toHaveProperty('review');
  });

  it('should keep the id and optional fields when rehydrated', () => {
    const movieEntry = new MovieEntry({ ...A_MOVIE_ENTRY, tmdbId: 0 });

    expect(movieEntry._id).toBe('entry-1');
    expect(movieEntry.tmdbId).toBe(0);
    expect(movieEntry.posterPublicId).toBe('posters/1');
  });
});

describe('When we update the details of a movie entry', () => {
  it('should change only the sent fields and renormalize the title', () => {
    const movieEntry = new MovieEntry(A_MOVIE_ENTRY);

    movieEntry.updateDetails({ title: ' Matrix Reloaded ', rating: 4 }, LATER);

    expect(movieEntry).toMatchObject({
      title: 'Matrix Reloaded',
      normalizedTitle: 'matrix reloaded',
      rating: 4,
      synopsis: A_MOVIE_ENTRY.synopsis,
      updatedAt: LATER,
    });
  });

  it('should clear director and review when sent blank', () => {
    const movieEntry = new MovieEntry(A_MOVIE_ENTRY);

    movieEntry.updateDetails({ director: ' ', review: '' }, LATER);

    expect(movieEntry.director).toBeUndefined();
    expect(movieEntry.review).toBeUndefined();
  });
});

describe('When we change the poster of a movie entry', () => {
  it('should replace and then remove the url and public id together', () => {
    const movieEntry = new MovieEntry(A_MOVIE_ENTRY);

    movieEntry.changePoster('https://img.example.com/p.png', undefined, LATER);
    expect(movieEntry.posterUrl).toBe('https://img.example.com/p.png');
    expect(movieEntry.posterPublicId).toBeUndefined();

    movieEntry.removePoster(LATER);
    expect(movieEntry.posterUrl).toBeUndefined();
    expect(movieEntry.updatedAt).toBe(LATER);
  });
});

describe('When we map a movie entry to its response', () => {
  it('should expose the id and hide internal fields', () => {
    const response = MovieEntry.toMovieEntryResponse(A_MOVIE_ENTRY);

    expect(response.id).toBe('entry-1');
    expect(response).not.toHaveProperty('_id');
    expect(response).not.toHaveProperty('normalizedTitle');
    expect(response).not.toHaveProperty('posterPublicId');
  });
});

describe('When we count how many times a movie was watched', () => {
  const FIRST_WATCH = new Date('2026-01-10T00:00:00.000Z');
  const LATER = new Date('2026-02-20T00:00:00.000Z');
  const params = {
    userId: 'user-1',
    title: 'Seven',
    synopsis: 'Two detectives.',
    releaseYear: 1995,
    genreIds: ['genre-1'],
    rating: 9,
    watchedAt: FIRST_WATCH,
  };

  it('should start at 1 unless a count is given', () => {
    expect(new MovieEntry(params).watchCount).toBe(1);
    expect(new MovieEntry({ ...params, watchCount: 3 }).watchCount).toBe(3);
  });

  it('should add one and move watchedAt to a later rewatch', () => {
    const movieEntry = new MovieEntry(params);

    movieEntry.rewatch(LATER, LATER);

    expect(movieEntry.watchCount).toBe(2);
    expect(movieEntry.watchedAt).toBe(LATER);
    expect(movieEntry.updatedAt).toBe(LATER);
  });

  it('should keep the latest watchedAt for an older, forgotten rewatch', () => {
    const movieEntry = new MovieEntry({ ...params, watchedAt: LATER });

    movieEntry.rewatch(FIRST_WATCH, LATER);

    expect(movieEntry.watchCount).toBe(2);
    expect(movieEntry.watchedAt).toBe(LATER);
  });

  it('should let the count be corrected through the details', () => {
    const movieEntry = new MovieEntry(params);

    movieEntry.updateDetails({ watchCount: 5 }, LATER);

    expect(movieEntry.watchCount).toBe(5);
  });
});
