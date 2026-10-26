export interface IMovieSearchResult {
  tmdbId: number;
  title: string;
  originalTitle: string;
  synopsis?: string;
  releaseYear?: number;
  posterUrl?: string;
  genreIds: string[];
}
