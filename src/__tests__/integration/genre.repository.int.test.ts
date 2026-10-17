import '../../../jest/setup-integration-tests';
import { Mgenre } from '../../infrastructure/db/mongo/models/genre.model';
import { GenreRepositoryRead } from '../../infrastructure/repository/genre/genre.repository.read';
import { GenreRepositoryWrite } from '../../infrastructure/repository/genre/genre.repository.write';
import { newObjectId } from '../testUtils';

const genreRepositoryRead = new GenreRepositoryRead();
const genreRepositoryWrite = new GenreRepositoryWrite();

let nextTmdbGenreId = 900000000 + Math.floor(Math.random() * 1000000);
const uniqueTmdbGenreId = () => nextTmdbGenreId++;

describe('When we upsert genres', () => {
  it('should insert new ones and update existing ones without changing their ids', async () => {
    const tmdbGenreId = uniqueTmdbGenreId();

    await genreRepositoryWrite.upsertGenres([{ name: 'Old name', tmdbGenreId }]);
    const [inserted] = await genreRepositoryRead.findGenresByTmdbIds([
      tmdbGenreId,
    ]);
    await genreRepositoryWrite.upsertGenres([{ name: 'New name', tmdbGenreId }]);
    const updated = await genreRepositoryRead.findGenresByTmdbIds([
      tmdbGenreId,
    ]);

    expect(inserted._id).toMatch(/^[0-9a-f]{24}$/);
    expect(updated).toEqual([{ _id: inserted._id, name: 'New name', tmdbGenreId }]);
    await expect(Mgenre.countDocuments({ tmdbGenreId })).resolves.toBe(1);
  });

  it('should do nothing with an empty list', async () => {
    const before = await Mgenre.countDocuments();

    await genreRepositoryWrite.upsertGenres([]);

    await expect(Mgenre.countDocuments()).resolves.toBe(before);
  });
});

describe('When we find genres by id', () => {
  it('should return only the existing ones and ignore malformed ids', async () => {
    const tmdbGenreId = uniqueTmdbGenreId();
    await genreRepositoryWrite.upsertGenres([{ name: 'Found', tmdbGenreId }]);
    const [genre] = await genreRepositoryRead.findGenresByTmdbIds([tmdbGenreId]);

    await expect(
      genreRepositoryRead.findGenresByIds([genre._id, newObjectId(), 'not-an-id']),
    ).resolves.toEqual([genre]);
    await expect(
      genreRepositoryRead.findGenresByIds(['not-an-id']),
    ).resolves.toEqual([]);
  });
});

describe('When we find genres by TMDB id', () => {
  it('should return an empty list when no id is given', async () => {
    await expect(genreRepositoryRead.findGenresByTmdbIds([])).resolves.toEqual(
      [],
    );
  });
});
