import supertest from 'supertest';
import { app } from '../../../jest/setup-integration-tests';
import { GenreSeedFactory } from '../../infrastructure/config/factories/genre.seed.factory';
import { GENRE_SEED } from '../../infrastructure/db/mongo/seed/genre.seed';

const SEEDED_NAMES = GENRE_SEED.map((genre) => genre.name);

beforeAll(async () => {
  await GenreSeedFactory.create().run();
});

describe('When we list the genres', () => {
  it('should return 200 with every seeded genre sorted by name in pt-BR', async () => {
    const { body, statusCode } = await supertest(app.app).get('/genres');

    expect(statusCode).toBe(200);
    const seededNames = (body as { name: string }[])
      .map((genre) => genre.name)
      .filter((name) => SEEDED_NAMES.includes(name));
    expect(seededNames).toEqual([
      'Ação',
      'Animação',
      'Aventura',
      'Cinema TV',
      'Comédia',
      'Crime',
      'Documentário',
      'Drama',
      'Família',
      'Fantasia',
      'Faroeste',
      'Ficção científica',
      'Guerra',
      'História',
      'Mistério',
      'Música',
      'Romance',
      'Terror',
      'Thriller',
    ]);
  });

  it('should expose only the id and the name of each genre', async () => {
    const { body } = await supertest(app.app).get('/genres');

    expect(body[0]).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      name: expect.any(String),
    });
  });
});

describe('When we run the genre seed twice', () => {
  it('should keep a single copy of each genre with the same id', async () => {
    const { body: before } = await supertest(app.app).get('/genres');

    await GenreSeedFactory.create().run();
    const { body: after } = await supertest(app.app).get('/genres');

    expect(after).toEqual(before);
  });
});
