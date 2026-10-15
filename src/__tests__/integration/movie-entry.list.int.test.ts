import supertest from 'supertest';
import '../../../jest/setup-integration-tests';
import {
  createMovieFor,
  KNOWN_GENRES,
  movieEntryApp,
} from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const userId = newObjectId();

const listMovies = (query: Record<string, string | number | boolean> = {}) =>
  supertest(movieEntryApp.app)
    .get('/movies')
    .query(query)
    .set('Authorization', authHeaderFor(userId));

const titlesOf = (body: { items: { title: string }[] }) =>
  body.items.map((movie) => movie.title);

beforeAll(async () => {
  await createMovieFor(userId, {
    title: 'Ágape',
    rating: 6,
    watchedAt: '2026-01-01',
  });
  await createMovieFor(userId, {
    title: 'Avatar',
    rating: 8.5,
    isFavorite: true,
    genreIds: [KNOWN_GENRES[1]._id],
    watchedAt: '2026-03-01',
  });
  await createMovieFor(userId, {
    title: 'Batman',
    rating: 9,
    watchedAt: '2026-02-01',
  });
  await createMovieFor(newObjectId(), { title: 'Not mine' });
});

describe('When we list our movies with the defaults', () => {
  it('should return only our movies, newest watched first, with page metadata', async () => {
    const { body, statusCode } = await listMovies();

    expect(statusCode).toBe(200);
    expect(titlesOf(body)).toEqual(['Avatar', 'Batman', 'Ágape']);
    expect(body).toMatchObject({ total: 3, page: 1, limit: 20 });
  });
});

describe('When we list our movies with sort and pagination', () => {
  it('should sort by title ignoring accents and paginate', async () => {
    const { body } = await listMovies({
      sort: 'title',
      order: 'asc',
      page: 2,
      limit: 2,
    });

    expect(titlesOf(body)).toEqual(['Batman']);
    expect(body).toMatchObject({ total: 3, page: 2, limit: 2 });
  });
});

describe('When we list our movies with filters', () => {
  it.each([
    ['search', { search: 'AGA' }, ['Ágape']],
    ['genre', { genreId: KNOWN_GENRES[1]._id }, ['Avatar']],
    ['rating range', { minRating: 8.5, maxRating: 9 }, ['Avatar', 'Batman']],
    ['favorite', { favorite: true }, ['Avatar']],
  ])('should filter by %s', async (_case, query, titles) => {
    const { body, statusCode } = await listMovies(query);

    expect(statusCode).toBe(200);
    expect(titlesOf(body)).toEqual(titles);
  });

  it('should return 422 when minRating is above maxRating', async () => {
    const { body, statusCode } = await listMovies({ minRating: 9, maxRating: 2 });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_RATING_RANGE');
  });

  it('should return 422 for an unknown genre', async () => {
    const { body, statusCode } = await listMovies({ genreId: newObjectId() });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_GENRE');
  });

  it.each([
    ['a rating out of the 0.5 steps', { minRating: 7.3 }],
    ['a limit above 50', { limit: 51 }],
    ['an unknown sort field', { sort: 'createdAt' }],
  ])('should return 400 for %s', async (_case, query) => {
    const { statusCode } = await listMovies(query);

    expect(statusCode).toBe(400);
  });
});
