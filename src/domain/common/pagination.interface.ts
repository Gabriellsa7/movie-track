export interface IPagination {
  limit: number;
  offset: number;
}

export interface IPaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
