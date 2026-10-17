import { Genre } from '../../domain/genre/genre.entity';
import { IGenre } from '../../domain/genre/interfaces/genre.interface';

const A_GENRE: IGenre = {
  _id: 'genre-1',
  name: 'Drama',
  tmdbGenreId: 18,
};

describe('When we create a genre entity', () => {
  it('should trim the name and leave the id to the database', () => {
    const genre = new Genre({ name: '  Drama  ', tmdbGenreId: 18 });

    expect(genre).not.toHaveProperty('_id');
    expect(genre.name).toBe('Drama');
    expect(genre.tmdbGenreId).toBe(18);
  });

  it('should keep every field of an existing genre', () => {
    const genre = new Genre(A_GENRE);

    expect({ ...genre }).toEqual(A_GENRE);
  });
});

describe('When we map a genre to the response shape', () => {
  it('should expose only the id and the name', () => {
    expect(Genre.toGenreResponse(A_GENRE)).toEqual({
      id: 'genre-1',
      name: 'Drama',
    });
  });
});
