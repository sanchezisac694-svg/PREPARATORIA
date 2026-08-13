import { AppLink, Button, EmptyState, type ReactNode } from "@preparatoria/ui";

export type RouteSearchParams = Record<string, string | string[] | undefined>;

export function readSingleParam(params: RouteSearchParams, key: string, fallback = "") {
  const value = params[key];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return fallback;
}

export function readPositiveNumberParam(params: RouteSearchParams, key: string, fallback: number) {
  const raw = readSingleParam(params, key, String(fallback));
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildHref(
  pathname: string,
  current: RouteSearchParams,
  updates: Record<string, string | number | null | undefined>,
) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value.length > 0) {
      query.set(key, value);
    } else if (Array.isArray(value) && typeof value[0] === "string" && value[0].length > 0) {
      query.set(key, value[0]);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined || value === "") {
      query.delete(key);
      continue;
    }

    query.set(key, String(value));
  }

  const search = query.toString();
  return search.length > 0 ? `${pathname}?${search}` : pathname;
}

export function PaginationControls({
  currentPage,
  pageCount,
  pathname,
  searchParams,
}: Readonly<{
  currentPage: number;
  pageCount: number;
  pathname: string;
  searchParams: RouteSearchParams;
}>) {
  if (pageCount <= 1) {
    return null;
  }

  const previousPage = currentPage > 1 ? currentPage - 1 : null;
  const nextPage = currentPage < pageCount ? currentPage + 1 : null;

  return (
    <nav aria-label="Paginación" className="control-school-pagination">
      {previousPage ? (
        <AppLink
          className="ui-button ui-button--secondary ui-button--sm"
          href={buildHref(pathname, searchParams, { page: previousPage })}
        >
          Anterior
        </AppLink>
      ) : (
        <Button disabled size="sm" variant="secondary">
          Anterior
        </Button>
      )}
      <span>{`Página ${currentPage} de ${pageCount}`}</span>
      {nextPage ? (
        <AppLink
          className="ui-button ui-button--secondary ui-button--sm"
          href={buildHref(pathname, searchParams, { page: nextPage })}
        >
          Siguiente
        </AppLink>
      ) : (
        <Button disabled size="sm" variant="secondary">
          Siguiente
        </Button>
      )}
    </nav>
  );
}

export function QueryFilters({
  children,
  title = "Filtros",
}: Readonly<{
  children: ReactNode;
  title?: string;
}>) {
  return (
    <section className="control-school-filters" aria-label={title}>
      {children}
    </section>
  );
}

export function EmptyResults({
  description,
  title,
}: Readonly<{
  description: string;
  title: string;
}>) {
  return <EmptyState description={description} title={title} />;
}
