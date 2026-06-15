import { useState, useMemo, useEffect } from "react";

interface UsePaginationOptions {
  totalItems: number;
  initialPage?: number;
  initialPageSize?: number;
}

interface UsePaginationReturn<T> {
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  paginate: (items: T[]) => T[];
  resetPage: () => void;
}

export function usePagination<T = unknown>({
  totalItems,
  initialPage = 1,
  initialPageSize = 20,
}: UsePaginationOptions): UsePaginationReturn<T> {
  const [page, setPageRaw] = useState(initialPage);
  const [pageSize, setPageSizeRaw] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page to valid range when totalPages changes
  useEffect(() => {
    if (page > totalPages) setPageRaw(1);
  }, [totalPages, page]);

  const setPage = (p: number) => setPageRaw(Math.max(1, Math.min(p, totalPages)));
  const setPageSize = (size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  };
  const resetPage = () => setPageRaw(1);

  const paginate = useMemo(
    () =>
      (items: T[]): T[] =>
        items.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize],
  );

  return { page, pageSize, totalPages, setPage, setPageSize, paginate, resetPage };
}
