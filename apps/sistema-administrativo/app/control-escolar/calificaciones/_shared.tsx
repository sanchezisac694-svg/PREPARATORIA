import { Alert, AppLink } from "@preparatoria/ui";

export {
  buildHref,
  EmptyResults,
  PaginationControls,
  QueryFilters,
  readPositiveNumberParam,
  readSingleParam,
  type RouteSearchParams,
} from "../_shared";

export function readStatusFeedback(
  params: Record<string, string | string[] | undefined>,
): { message: string; tone: "danger" | "info" | "success" | "warning" } | null {
  const status = typeof params.status === "string" ? params.status : null;
  const message = typeof params.message === "string" ? params.message : null;

  if (!status || !message) {
    return null;
  }

  switch (status) {
    case "success":
      return { message, tone: "success" };
    case "warning":
      return { message, tone: "warning" };
    case "info":
      return { message, tone: "info" };
    default:
      return { message, tone: "danger" };
  }
}

export function StatusFeedback({
  params,
}: Readonly<{
  params: Record<string, string | string[] | undefined>;
}>) {
  const feedback = readStatusFeedback(params);
  if (!feedback) {
    return null;
  }

  return <Alert tone={feedback.tone}>{feedback.message}</Alert>;
}

export function GradeModuleNav() {
  return (
    <nav aria-label="Rutas de calificaciones">
      <ul>
        <li>
          <AppLink href="/control-escolar/calificaciones">Listado administrativo</AppLink>
        </li>
        <li>
          <AppLink href="/control-escolar/calificaciones/mis-grupos">Mi carga docente</AppLink>
        </li>
        <li>
          <AppLink href="/control-escolar/calificaciones/ventanas">Ventanas</AppLink>
        </li>
        <li>
          <AppLink href="/control-escolar/calificaciones/correcciones">Correcciones</AppLink>
        </li>
      </ul>
    </nav>
  );
}
