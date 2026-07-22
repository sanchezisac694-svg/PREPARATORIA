import { unstable_noStore as noStore } from "next/cache";

import { getStudentPortalService } from "../../../lib/student-portal";
import { StudentPortalEmpty, StudentPortalSection } from "../_components";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function StudentPermissionsPage() {
  noStore();
  const service = await getStudentPortalService();
  const permissions = await service.getPermissions();
  const rows = Array.isArray(permissions) ? (permissions as Array<Record<string, unknown>>) : [];

  return (
    <StudentPortalSection title="Permisos visibles">
      {rows.length === 0 ? (
        <StudentPortalEmpty message="No existen permisos aprobados o aplicados para este periodo." />
      ) : (
        <table className="student-portal-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Motivo</th>
              <th>Validación visible</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${String(row.permissionType ?? "permission")}-${index}`}>
                <td>{String(row.appliesToDate ?? "-")}</td>
                <td>{String(row.permissionType ?? "-")}</td>
                <td>{String(row.status ?? "-")}</td>
                <td>{String(row.reasonCode ?? "-")}</td>
                <td>{String(row.visibleValidationStatus ?? "Sin validación visible")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StudentPortalSection>
  );
}
