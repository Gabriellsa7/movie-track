import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { Mwatchlist } from '../../infrastructure/db/mongo/models/watchlist.model';
import { Mgenre } from '../../infrastructure/db/mongo/models/genre.model';
import { GenreSeedFactory } from '../../infrastructure/config/factories/genre.seed.factory';
import { createMovieFor } from '../configMovieEntryApp';
import { authHeaderFor, ensureUserExists, newObjectId } from '../testUtils';

const addItem = async (userId: string, item: object) => {
  await ensureUserExists(userId);
  return supertest(app.app)
    .post('/watchlist')
    .set('Authorization', authHeaderFor(userId))
    .send(item);
};

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
      priority: 'medium',
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

const updateItem = (userId: string, id: string, body: object) =>
  supertest(app.app)
    .put(`/watchlist/${id}`)
    .set('Authorization', authHeaderFor(userId))
    .send(body);

describe('When we add a movie with a priority and a note', () => {
  it('should keep both', async () => {
    const { body } = await addItem(newObjectId(), {
      title: 'Seven',
      priority: 'high',
      note: '  Recommended by Ana  ',
    });

    expect(body).toMatchObject({ priority: 'high', note: 'Recommended by Ana' });
  });
});

describe('When we edit a movie in our watchlist', () => {
  it('should change only the fields sent', async () => {
    const userId = newObjectId();
    const { body: item } = await addItem(userId, {
      title: 'Sevn',
      releaseYear: 1995,
      note: 'Typo in the title',
    });

    const { body, statusCode } = await updateItem(userId, item.id, {
      title: 'Seven',
      priority: 'low',
    });

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      id: item.id,
      title: 'Seven',
      releaseYear: 1995,
      priority: 'low',
      note: 'Typo in the title',
    });
  });

  it('should clear the year and poster with null and the note with an empty text', async () => {
    const userId = newObjectId();
    const { body: item } = await addItem(userId, {
      title: 'Seven',
      releaseYear: 1995,
      posterUrl: 'https://cdn.example.com/seven.png',
      note: 'Some note',
    });

    const { body } = await updateItem(userId, item.id, {
      releaseYear: null,
      posterUrl: null,
      note: '',
    });

    expect(body).not.toHaveProperty('releaseYear');
    expect(body).not.toHaveProperty('posterUrl');
    expect(body).not.toHaveProperty('note');
    const inDb = await Mwatchlist.findById(item.id).lean();
    expect(inDb).not.toHaveProperty('note');
  });

  it('should return 409 ALREADY_IN_WATCHLIST when it becomes another item', async () => {
    const userId = newObjectId();
    await addItem(userId, { title: 'Seven', releaseYear: 1995 });
    const { body: other } = await addItem(userId, { title: 'Alien' });

    const { body, statusCode } = await updateItem(userId, other.id, {
      title: 'seven',
      releaseYear: 1995,
    });

    expect(statusCode).toBe(409);
    expect(body.code).toBe('ALREADY_IN_WATCHLIST');
  });

  it('should return 409 MOVIE_ALREADY_LOGGED when it becomes a watched movie', async () => {
    const userId = newObjectId();
    await createMovieFor(userId, { title: 'Alien', releaseYear: 1979 });
    const { body: item } = await addItem(userId, { title: 'Aliens' });

    const { body, statusCode } = await updateItem(userId, item.id, {
      title: 'Alien',
      releaseYear: 1979,
    });

    expect(statusCode).toBe(409);
    expect(body.code).toBe('MOVIE_ALREADY_LOGGED');
  });

  it('should not compare the item with itself when the movie stays the same', async () => {
    const userId = newObjectId();
    const { body: item } = await addItem(userId, {
      title: 'Seven',
      releaseYear: 1995,
    });

    const { statusCode } = await updateItem(userId, item.id, {
      title: 'Seven',
      note: 'Watch on Friday',
    });

    expect(statusCode).toBe(200);
  });

  it('should return 404 for an item that is not ours and 400 for an empty body', async () => {
    const { body: item } = await addItem(newObjectId(), { title: 'Seven' });

    const notOurs = await updateItem(newObjectId(), item.id, {
      priority: 'high',
    });
    const empty = await updateItem(newObjectId(), item.id, {});

    expect(notOurs.statusCode).toBe(404);
    expect(notOurs.body.code).toBe('WATCHLIST_ITEM_NOT_FOUND');
    expect(empty.statusCode).toBe(400);
  });
});

describe('When we list our watchlist by priority', () => {
  const userId = newObjectId();

  beforeAll(async () => {
    await addItem(userId, { title: 'Low one', priority: 'low' });
    await addItem(userId, { title: 'High one', priority: 'high' });
    const { body: legacy } = await addItem(userId, { title: 'Old item' });
    await Mwatchlist.updateOne(
      { _id: legacy.id },
      { $unset: { priority: '' } },
    );
    await addItem(userId, { title: 'Medium one', priority: 'medium' });
  });

  it('should list high first, then medium (old items included), then low', async () => {
    const { body } = await listItems(userId, { sort: 'priority' });

    expect(titlesOf(body)).toEqual([
      'High one',
      'Medium one',
      'Old item',
      'Low one',
    ]);
    expect(body.items[2].priority).toBe('medium');
  });

  it('should filter by priority, counting items without one as medium', async () => {
    const { body } = await listItems(userId, { priority: 'medium' });

    expect(titlesOf(body)).toEqual(['Medium one', 'Old item']);
    expect(body.total).toBe(2);
  });
});

describe('When we plan the next movies to watch', () => {
  const userId = newObjectId();

  beforeAll(async () => {
    await addItem(userId, { title: 'Some day' });
    await addItem(userId, { title: 'Saturday', plannedFor: '2026-11-07' });
    await addItem(userId, { title: 'Tomorrow', plannedFor: '2026-11-01' });
  });

  it('should list only the planned ones, soonest first', async () => {
    const { body } = await listItems(userId, {
      planned: 'true',
      sort: 'plannedFor',
    });

    expect(titlesOf(body)).toEqual(['Tomorrow', 'Saturday']);
    expect(body.items[0].plannedFor).toBe('2026-11-01T00:00:00.000Z');
  });

  it('should list the ones without a date with planned=false', async () => {
    const { body } = await listItems(userId, { planned: 'false' });

    expect(titlesOf(body)).toEqual(['Some day']);
  });

  it('should put the items without a date last when sorting by plan', async () => {
    const { body } = await listItems(userId, { sort: 'plannedFor' });

    expect(titlesOf(body)).toEqual(['Tomorrow', 'Saturday', 'Some day']);
  });

  it('should move or clear the plan when editing', async () => {
    const { body: item } = await addItem(userId, {
      title: 'Moved',
      plannedFor: '2026-11-02',
    });

    const moved = await updateItem(userId, item.id, {
      plannedFor: '2026-12-25',
    });
    const cleared = await updateItem(userId, item.id, { plannedFor: null });

    expect(moved.body.plannedFor).toBe('2026-12-25T00:00:00.000Z');
    expect(cleared.body).not.toHaveProperty('plannedFor');
  });
});

describe('When a watchlist item has the movie data', () => {
  it('should keep valid genres and reject unknown ones', async () => {
    await GenreSeedFactory.create().run();
    const drama = await Mgenre.findOne({ tmdbGenreId: 18 }).lean();
    const userId = newObjectId();

    const valid = await addItem(userId, {
      title: 'Whiplash',
      synopsis: 'A young drummer.',
      genreIds: [drama!._id.toString()],
      director: 'Damien Chazelle',
      durationMinutes: 106,
    });
    const invalid = await addItem(userId, {
      title: 'Other',
      genreIds: [newObjectId()],
    });

    expect(valid.statusCode).toBe(201);
    expect(valid.body).toMatchObject({
      synopsis: 'A young drummer.',
      genreIds: [drama!._id.toString()],
      director: 'Damien Chazelle',
      durationMinutes: 106,
    });
    expect(invalid.statusCode).toBe(422);
    expect(invalid.body.code).toBe('INVALID_GENRE');
  });
});
