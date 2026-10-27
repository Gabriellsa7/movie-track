import { EWatchlistPriority } from '../../domain/watchlist/interfaces/watchlist.interface';
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
      priority: EWatchlistPriority.HIGH,
      note: 'Recommended by Ana',
      addedAt: ADDED_AT,
    });

    expect(response).toEqual({
      id: 'item-1',
      userId: 'user-1',
      title: 'Seven',
      releaseYear: 1995,
      priority: EWatchlistPriority.HIGH,
      note: 'Recommended by Ana',
      addedAt: ADDED_AT,
    });
  });
});

describe('When we edit a watchlist item', () => {
  const ITEM = {
    userId: 'user-1',
    title: 'Sevn',
    releaseYear: 1995,
    tmdbId: 807,
    posterUrl: 'https://cdn.example.com/seven.png',
    note: 'A note',
  };

  it('should default the priority to medium and drop a blank note', () => {
    const item = new WatchlistItem({ userId: 'user-1', title: 'Seven', note: '  ' });

    expect(item.priority).toBe(EWatchlistPriority.MEDIUM);
    expect(item).not.toHaveProperty('note');
  });

  it('should change only the fields given, renormalizing the title', () => {
    const item = new WatchlistItem(ITEM);

    item.updateDetails({ title: ' Séven ', priority: EWatchlistPriority.HIGH });

    expect(item).toMatchObject({
      title: 'Séven',
      normalizedTitle: 'seven',
      releaseYear: 1995,
      priority: EWatchlistPriority.HIGH,
      note: 'A note',
    });
  });

  it('should clear fields with null and the note with an empty text', () => {
    const item = new WatchlistItem(ITEM);

    item.updateDetails({
      releaseYear: null,
      tmdbId: null,
      posterUrl: null,
      note: '   ',
    });

    expect(item.releaseYear).toBeUndefined();
    expect(item.tmdbId).toBeUndefined();
    expect(item.posterUrl).toBeUndefined();
    expect(item.note).toBeUndefined();
  });
});
