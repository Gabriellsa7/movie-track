import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { createMovieFor } from '../configMovieEntryApp';
import { authHeaderFor, newObjectId } from '../testUtils';

const addItem = (userId: string, item: object) =>
  supertest(app.app)
    .post('/watchlist')
    .set('Authorization', authHeaderFor(userId))
    .send(item);

const listItems = (
  userId: string,
  query: Record<string, string | number> = {},
) =>
  supertest(app.app)
    .get('/watchlist')
    .query(query)
    .set('Authorization', authHeaderFor(userId));

const removeItem = (userId: string, id: string) =>
  supertest(app.app)
    .delete(`/watchlist/${id}`)
    .set('Authorization', authHeaderFor(userId));

const titlesOf = (body: { items: { title: string }[] }) =>
  body.items.map((item) => item.title);

describe('When we add a movie to our watchlist', () => {
  it('should return 201 with the item in the contract shape', async () => {
    const userId = newObjectId();

    const { body, statusCode } = await addItem(userId, {
      title: '  O Auto da Compadecida ',
      releaseYear: 2000,
      tmdbId: 37165,
      posterUrl: 'https://cdn.example.com/auto.png',
    });

    expect(statusCode).toBe(201);
    expect(body).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      userId,
      title: 'O Auto da Compadecida',
      releaseYear: 2000,
      tmdbId: 37165,
      posterUrl: 'https://cdn.example.com/auto.png',
      addedAt: expect.any(String),
    });
  });

  it('should accept only a title', async () => {
    const { body, statusCode } = await addItem(newObjectId(), {
      title: 'Seven',
    });

    expect(statusCode).toBe(201);
    expect(body).not.toHaveProperty('releaseYear');
  });
});

describe('When we add a movie that is already in our watchlist', () => {
  it('should return 409 ALREADY_IN_WATCHLIST for the same title and year, ignoring accents', async () => {
    const userId = newObjectId();
    await addItem(userId, { title: 'Ágape', releaseYear: 2020 });

    const { body, statusCode } = await addItem(userId, {
      title: 'agape',
      releaseYear: 2020,
    });

    expect(statusCode).toBe(409);
    expect(body.code).toBe('ALREADY_IN_WATCHLIST');
  });

  it('should return 409 for the same tmdbId with another title', async () => {
    const userId = newObjectId();
    await addItem(userId, { title: 'Se7en', tmdbId: 807 });

    const { statusCode } = await addItem(userId, {
      title: 'Seven',
      tmdbId: 807,
    });

    expect(statusCode).toBe(409);
  });

  it("should accept the same movie in another user's watchlist", async () => {
    await addItem(newObjectId(), { title: 'Seven', releaseYear: 1995 });

    const { statusCode } = await addItem(newObjectId(), {
      title: 'Seven',
      releaseYear: 1995,
    });

    expect(statusCode).toBe(201);
  });
});

describe('When we add a movie we have already watched', () => {
  it('should return 409 MOVIE_ALREADY_LOGGED for the same title and year', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { title: 'Cidade de Deus', releaseYear: 2002 });

    const { body, statusCode } = await addItem(userId, {
      title: 'cidade de deus',
      releaseYear: 2002,
    });

    expect(statusCode).toBe(409);
    expect(body.code).toBe('MOVIE_ALREADY_LOGGED');
  });

  it('should return 409 MOVIE_ALREADY_LOGGED for the same tmdbId without a year', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { title: 'Cidade de Deus', tmdbId: 598 });

    const { statusCode } = await addItem(userId, {
      title: 'City of God',
      tmdbId: 598,
    });

    expect(statusCode).toBe(409);
  });

  it('should accept a movie with the same title but another year (a remake)', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { title: 'Duna', releaseYear: 1984 });

    const withAnotherYear = await addItem(userId, {
      title: 'Duna',
      releaseYear: 2021,
    });
    const withoutYear = await addItem(userId, { title: 'Duna' });

    expect(withAnotherYear.statusCode).toBe(201);
    expect(withoutYear.statusCode).toBe(201);
  });
});

describe('When we add an invalid movie to our watchlist', () => {
  it('should return 400 VALIDATION_ERROR without a title', async () => {
    const { body, statusCode } = await addItem(newObjectId(), {
      releaseYear: 2000,
    });

    expect(statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('should return 422 INVALID_RELEASE_YEAR for a year after next year', async () => {
    const { body, statusCode } = await addItem(newObjectId(), {
      title: 'Far future',
      releaseYear: new Date().getUTCFullYear() + 2,
    });

    expect(statusCode).toBe(422);
    expect(body.code).toBe('INVALID_RELEASE_YEAR');
  });
});

describe('When we list our watchlist', () => {
  const userId = newObjectId();

  beforeAll(async () => {
    await addItem(userId, { title: 'Ágape' });
    await addItem(userId, { title: 'Avatar' });
    await addItem(userId, { title: 'Batman' });
    await addItem(newObjectId(), { title: 'Not mine' });
  });

  it('should return only our items, most recently added first, with page metadata', async () => {
    const { body, statusCode } = await listItems(userId);

    expect(statusCode).toBe(200);
    expect(titlesOf(body)).toEqual(['Batman', 'Avatar', 'Ágape']);
    expect(body).toMatchObject({ total: 3, page: 1, limit: 20 });
  });

  it('should search by title ignoring case and accents', async () => {
    const { body } = await listItems(userId, { search: 'AGA' });

    expect(titlesOf(body)).toEqual(['Ágape']);
    expect(body.total).toBe(1);
  });

  it('should paginate', async () => {
    const { body } = await listItems(userId, { page: 2, limit: 2 });

    expect(titlesOf(body)).toEqual(['Ágape']);
    expect(body).toMatchObject({ total: 3, page: 2, limit: 2 });
  });

  it('should return 400 for a limit above 50', async () => {
    const { statusCode } = await listItems(userId, { limit: 51 });

    expect(statusCode).toBe(400);
  });
});

describe('When we remove a movie from our watchlist', () => {
  it('should return 204 and delete it', async () => {
    const userId = newObjectId();
    const { body: item } = await addItem(userId, { title: 'Seven' });

    const { statusCode } = await removeItem(userId, item.id);

    expect(statusCode).toBe(204);
    await expect(Mwatchlist.findById(item.id)).resolves.toBeNull();
  });

  it('should return 404 WATCHLIST_ITEM_NOT_FOUND for an item that is not ours', async () => {
    const { body: item } = await addItem(newObjectId(), { title: 'Seven' });

    const { body, statusCode } = await removeItem(newObjectId(), item.id);

    expect(statusCode).toBe(404);
    expect(body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
    await expect(Mwatchlist.findById(item.id)).resolves.not.toBeNull();
  });

  it('should return 400 for a malformed id', async () => {
    const { statusCode } = await removeItem(newObjectId(), 'not-an-id');

    expect(statusCode).toBe(400);
  });
});

describe('When we use the watchlist without a token', () => {
  it('should return 401', async () => {
    const { statusCode } = await supertest(app.app).get('/watchlist');

    expect(statusCode).toBe(401);
  });
});
