import { WatchlistItem } from '../../domain/watchlist/watchlist.entity';

const ADDED_AT = new Date('2026-02-01T00:00:00.000Z');

describe('When we build a watchlist item', () => {
  it('should trim the title and keep a normalized copy for search', () => {
    const item = new WatchlistItem({
      userId: 'user-1',
      title: '  O Auto da   Compadecida ',
      addedAt: ADDED_AT,
    });

    expect(item.title).toBe('O Auto da   Compadecida');
    expect(item.normalizedTitle).toBe('o auto da compadecida');
    expect(item.addedAt).toBe(ADDED_AT);
  });

  it('should only set the optional fields that were given', () => {
    const item = new WatchlistItem({ userId: 'user-1', title: 'Seven' });

    expect(item).not.toHaveProperty('_id');
    expect(item).not.toHaveProperty('tmdbId');
    expect(item).not.toHaveProperty('posterUrl');
    expect(item).not.toHaveProperty('releaseYear');
    expect(item.addedAt).toBeInstanceOf(Date);
  });

  it('should keep the optional fields when given', () => {
    const item = new WatchlistItem({
      _id: 'item-1',
      userId: 'user-1',
      title: 'Seven',
      tmdbId: 807,
      posterUrl: 'https://cdn.example.com/seven.png',
      releaseYear: 1995,
    });

    expect(item).toMatchObject({
      _id: 'item-1',
      tmdbId: 807,
      posterUrl: 'https://cdn.example.com/seven.png',
      releaseYear: 1995,
    });
  });
});

describe('When we map a watchlist item to the response', () => {
  it('should expose the id and hide the normalized title', () => {
    const response = WatchlistItem.toWatchlistItemResponse({
      _id: 'item-1',
      userId: 'user-1',
      title: 'Seven',
      normalizedTitle: 'seven',
      releaseYear: 1995,
      addedAt: ADDED_AT,
    });

    expect(response).toEqual({
      id: 'item-1',
      userId: 'user-1',
      title: 'Seven',
      releaseYear: 1995,
      addedAt: ADDED_AT,
    });
  });
});
