import { hasAnyPermission, permissions } from "@preparatoria/authz";
import {
  AppLink,
  Card,
  Container,
  DataTable,
  ErrorState,
  Field,
  Input,
  PageHeader,
  TableBodySection,
  TableCell,
  TableHeadCell,
  TableHeadSection,
  TableRow,
} from "@preparatoria/ui";

import {
  formatGradeValue,
  GradeStatusBadge,
  renderDisplayName,
  renderGradeBoolean,
  renderTeacher,
} from "../../../_admin/grade-labels";
import {
  GradeManagementUiError,
  getGradeManagementOfferingDetail,
  requireGradeManagementAccess,
} from "../../../../lib/grade-management";
import {
  cancelStudentUnitGradeAction,
  captureStudentUnitGradeAction,
  confirmSubjectFinalResultAction,
  createGradeCorrectionAction,
  finalizeStudentUnitGradeAction,
  reviewStudentUnitGradeAction,
} from "../actions";
import { ConfirmSubmitButton } from "../confirm-submit-button";
import { GradeModuleNav, StatusFeedback, type RouteSearchParams } from "../_shared";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function canCaptureIntoStatus(status: string) {
  return status !== "FINALIZED" && status !== "CANCELLED";
}

function canReviewStatus(status: string) {
  return status === "CAPTURED";
}

function canFinalizeStatus(status: string) {
  return status === "REVIEWED";
}

function canCancelStatus(status: string) {
  return status !== "FINALIZED" && status !== "CANCELLED";
}

export default async function GradeOfferingDetailPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ academicOfferingId: string }>;
  searchParams?: Promise<RouteSearchParams>;
}>) {
  const routeParams = await params;
  const query = (await searchParams) ?? {};
  const returnPath = `/control-escolar/calificaciones/${routeParams.academicOfferingId}`;

  try {
    const { identity } = await requireGradeManagementAccess([permissions.ACADEMIC_GRADES_READ]);
    const detail = await getGradeManagementOfferingDetail(routeParams.academicOfferingId);
    const canCapture = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_CAPTURE,
    ]);
    const canReview = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_REVIEW,
    ]);
    const canFinalize = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_FINALIZE,
    ]);
    const canCorrect = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_GRADES_CORRECT,
    ]);
    const canReadResults = hasAnyPermission(identity.context.roleCodes, [
      permissions.ACADEMIC_SUBJECT_RESULTS_READ,
    ]);

    return (
      <Container>
        <PageHeader
          description="Detalle por grupo y materia utilizando únicamente el contrato público de calificaciones."
          title="Detalle del offering"
        />

        <StatusFeedback params={query} />

        <Card>
          <h2>Contexto académico</h2>
          <p>{`${detail.offering.group.code} · ${detail.offering.group.name}`}</p>
          <p>{`${detail.offering.subject.code} · ${detail.offering.subject.name}`}</p>
          <p>{detail.offering.academicPeriod.name}</p>
          <p>{`${detail.offering.semesterNumber}° semestre`}</p>
          <p>{detail.offering.trainingArea?.name ?? "Área no disponible"}</p>
          <p>{renderTeacher(detail.offering.teacher?.teacherDisplayName)}</p>
          <div className="control-school-badge-row">
            <GradeStatusBadge value={detail.offering.offeringStatus} />
          </div>
          <GradeModuleNav />
        </Card>

        <Card>
          <h2>Estudiantes y calificaciones</h2>
          <DataTable caption="Estudiantes visibles del offering">
            <TableHeadSection>
              <TableRow>
                <TableHeadCell>Matrícula</TableHeadCell>
                <TableHeadCell>Nombre</TableHeadCell>
                <TableHeadCell>Unidad 1</TableHeadCell>
                <TableHeadCell>Unidad 2</TableHeadCell>
                <TableHeadCell>Unidad 3</TableHeadCell>
                <TableHeadCell>Resultado</TableHeadCell>
                <TableHeadCell>Historial</TableHeadCell>
              </TableRow>
            </TableHeadSection>
            <TableBodySection>
              {detail.students.map((student) => (
                <TableRow key={student.studentOfferingEnrollmentId}>
                  <TableCell>{student.studentIdentifier}</TableCell>
                  <TableCell>{renderDisplayName(student.studentDisplayName)}</TableCell>
                  {student.unitGrades.map((unit) => (
                    <TableCell key={unit.studentUnitGradeId}>
                      <div>
                        <div>{`Raw: ${formatGradeValue(unit.rawGrade)}`}</div>
                        <div>{`Normalizada: ${formatGradeValue(unit.normalizedGrade)}`}</div>
                        <div>{`Acreditada: ${renderGradeBoolean(unit.isAccredited)}`}</div>
                        <GradeStatusBadge value={unit.status} />
                      </div>
                      {canCapture && canCaptureIntoStatus(unit.status) ? (
                        <form action={captureStudentUnitGradeAction}>
                          <input
                            name="studentOfferingEnrollmentId"
                            type="hidden"
                            value={student.studentOfferingEnrollmentId}
                          />
                          <input name="subjectUnitId" type="hidden" value={unit.subjectUnitId} />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <Field
                            helpText="Validación visual básica; el backend conserva la regla oficial."
                            label={`Unidad ${unit.unitNumber}`}
                            labelFor={`grade-${unit.studentUnitGradeId}`}
                          >
                            <Input
                              defaultValue={String(unit.rawGrade)}
                              id={`grade-${unit.studentUnitGradeId}`}
                              max="10"
                              min="0"
                              name="rawGrade"
                              required
                              step="0.01"
                              type="number"
                            />
                          </Field>
                          <button
                            className="ui-button ui-button--primary ui-button--sm"
                            type="submit"
                          >
                            Guardar unidad
                          </button>
                        </form>
                      ) : null}
                      <div className="control-school-inline-actions">
                        {canReview && canReviewStatus(unit.status) ? (
                          <form action={reviewStudentUnitGradeAction}>
                            <input
                              name="studentUnitGradeId"
                              type="hidden"
                              value={unit.studentUnitGradeId}
                            />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <button
                              className="ui-button ui-button--secondary ui-button--sm"
                              type="submit"
                            >
                              Marcar revisión
                            </button>
                          </form>
                        ) : null}
                        {canFinalize && canFinalizeStatus(unit.status) ? (
                          <form action={finalizeStudentUnitGradeAction}>
                            <input
                              name="studentUnitGradeId"
                              type="hidden"
                              value={unit.studentUnitGradeId}
                            />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <ConfirmSubmitButton confirmationMessage="¿Confirmas finalizar esta unidad?">
                              Finalizar unidad
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                        {canFinalize && canCancelStatus(unit.status) ? (
                          <form action={cancelStudentUnitGradeAction}>
                            <input
                              name="studentUnitGradeId"
                              type="hidden"
                              value={unit.studentUnitGradeId}
                            />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <ConfirmSubmitButton
                              confirmationMessage="¿Confirmas cancelar esta captura de unidad?"
                              tone="danger"
                            >
                              Cancelar unidad
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </div>
                      {canCorrect ? (
                        <form action={createGradeCorrectionAction}>
                          <input
                            name="studentUnitGradeId"
                            type="hidden"
                            value={unit.studentUnitGradeId}
                          />
                          <input name="returnPath" type="hidden" value={returnPath} />
                          <Field
                            label="Corrección propuesta"
                            labelFor={`correction-grade-${unit.studentUnitGradeId}`}
                          >
                            <Input
                              id={`correction-grade-${unit.studentUnitGradeId}`}
                              max="10"
                              min="0"
                              name="proposedRawGrade"
                              step="0.01"
                              type="number"
                            />
                          </Field>
                          <Field
                            label="Motivo"
                            labelFor={`correction-reason-${unit.studentUnitGradeId}`}
                          >
                            <Input
                              id={`correction-reason-${unit.studentUnitGradeId}`}
                              name="gradeCorrectionReason"
                              placeholder="Motivo institucional"
                              required
                            />
                          </Field>
                          <button
                            className="ui-button ui-button--secondary ui-button--sm"
                            type="submit"
                          >
                            Registrar corrección
                          </button>
                        </form>
                      ) : null}
                    </TableCell>
                  ))}
                  <TableCell>
                    {student.subjectResult ? (
                      <div>
                        <div>{`Resultado: ${student.subjectResult.resultCode}`}</div>
                        <div>{`Estado: ${student.subjectResult.status}`}</div>
                        <div>{`Final raw: ${formatGradeValue(student.subjectResult.rawFinalGrade)}`}</div>
                        <div>
                          {`Final backend: ${formatGradeValue(student.subjectResult.roundedFinalGrade)}`}
                        </div>
                        <div>
                          {`Cálculo: ${student.subjectResult.calculationStatus === "MANUAL_REVIEW_REQUIRED" ? "Revisión institucional requerida" : student.subjectResult.calculationStatus}`}
                        </div>
                        <div>{`${student.subjectResult.accreditedUnitCount} acreditadas`}</div>
                        <div>{`${student.subjectResult.nonAccreditedUnitCount} no acreditadas`}</div>
                        <GradeStatusBadge value={student.subjectResult.resultCode} />
                        <GradeStatusBadge value={student.subjectResult.status} />
                        {canFinalize && student.subjectResult.status === "CALCULATED" ? (
                          <form action={confirmSubjectFinalResultAction}>
                            <input
                              name="subjectFinalResultId"
                              type="hidden"
                              value={student.subjectResult.subjectFinalResultId}
                            />
                            <input name="returnPath" type="hidden" value={returnPath} />
                            <ConfirmSubmitButton confirmationMessage="¿Confirmas el resultado de materia devuelto por el backend?">
                              Confirmar resultado
                            </ConfirmSubmitButton>
                          </form>
                        ) : null}
                      </div>
                    ) : canReadResults ? (
                      "No definida"
                    ) : (
                      "Sin permiso de lectura"
                    )}
                  </TableCell>
                  <TableCell>
                    <ul>
                      {student.unitGrades.map((unit) => (
                        <li key={`${unit.studentUnitGradeId}-history`}>
                          <AppLink
                            href={`/control-escolar/calificaciones/${routeParams.academicOfferingId}/unidades/${unit.studentUnitGradeId}`}
                          >
                            {`Historial U${unit.unitNumber}`}
                          </AppLink>
                        </li>
                      ))}
                      {student.subjectResult ? (
                        <li>
                          <AppLink
                            href={`/control-escolar/calificaciones/${routeParams.academicOfferingId}/resultados/${student.subjectResult.subjectFinalResultId}`}
                          >
                            Historial resultado
                          </AppLink>
                        </li>
                      ) : null}
                    </ul>
                  </TableCell>
                </TableRow>
              ))}
            </TableBodySection>
          </DataTable>
        </Card>
      </Container>
    );
  } catch (error) {
    if (error instanceof GradeManagementUiError) {
      return (
        <Container>
          <PageHeader title="Detalle del offering" />
          <ErrorState
            description="No fue posible cargar el detalle de calificaciones para este offering."
            title="No fue posible cargar el offering"
          />
        </Container>
      );
    }

    throw error;
  }
}
