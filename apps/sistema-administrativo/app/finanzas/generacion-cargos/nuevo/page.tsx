import { Alert, Button, Card, Container, Field, Input, PageHeader } from "@preparatoria/ui";

import { FinancialActionFeedback, readFeedback } from "../../../_admin/financial-feedback";
import { FinancialStatusBadge } from "../../../_admin/financial-labels";
import { createChargeGenerationBatchAction } from "../actions";
import { requireAdminAccess } from "../../../../lib/auth";
import { getChargeGenerationAdapter } from "../../../../lib/charge-generation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewChargeGenerationBatchPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>) {
  await requireAdminAccess();
  const params = (await searchParams) ?? {};
  const feedback = readFeedback(params);
  const targetAcademicPeriodId =
    typeof params.targetAcademicPeriodId === "string" ? params.targetAcademicPeriodId : "";
  const targetRuleVersionId =
    typeof params.targetRuleVersionId === "string" ? params.targetRuleVersionId : "";

  const preview =
    targetAcademicPeriodId && targetRuleVersionId
      ? await getChargeGenerationAdapter()
          .then((adapter) =>
            adapter.preview({
              target_academic_period_id: targetAcademicPeriodId,
              target_rule_version_id: targetRuleVersionId,
            }),
          )
          .catch(() => null)
      : null;

  return (
    <Container>
      <PageHeader
        description="Vista previa obligatoria antes de crear el lote institucional."
        title="Nuevo lote de cargos"
      />

      <FinancialActionFeedback {...feedback} />

      <Card>
        <h2>Generar vista previa</h2>
        <form method="get">
          <Field label="Periodo académico" labelFor="targetAcademicPeriodId">
            <Input
              defaultValue={targetAcademicPeriodId}
              id="targetAcademicPeriodId"
              name="targetAcademicPeriodId"
              placeholder="UUID del periodo"
              required
            />
          </Field>
          <Field label="Versión de regla" labelFor="targetRuleVersionId">
            <Input
              defaultValue={targetRuleVersionId}
              id="targetRuleVersionId"
              name="targetRuleVersionId"
              placeholder="UUID de la versión"
              required
            />
          </Field>
          <Button type="submit" variant="secondary">
            Ver vista previa
          </Button>
        </form>
      </Card>

      {preview ? (
        <>
          <Card>
            <h2>Resumen de la vista previa</h2>
            <ul>
              <li>Candidatos: {preview.totalCandidates}</li>
              <li>Elegibles: {preview.totalEligible}</li>
              <li>Ya cobrados: {preview.totalAlreadyCharged}</li>
              <li>Excluidos: {preview.totalExcluded}</li>
              <li>Revisión institucional: {preview.totalManualReview}</li>
              <li>Sin tarifa aplicable: {preview.totalWithoutRate}</li>
              <li>Total estimado: {preview.estimatedTotal}</li>
            </ul>
          </Card>

          <Card>
            <h2>Primeros resultados</h2>
            {preview.items.length === 0 ? (
              <Alert tone="info">La vista previa no devolvió candidatos visibles.</Alert>
            ) : (
              <ul>
                {preview.items.slice(0, 10).map((item, index) => (
                  <li key={`${item.studentIdentifier ?? "row"}-${index}`}>
                    {(item.studentIdentifier ?? "Sin matrícula") + " · "}
                    <FinancialStatusBadge value={item.eligibilityStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2>Crear lote</h2>
            <form action={createChargeGenerationBatchAction}>
              <input type="hidden" name="targetAcademicPeriodId" value={targetAcademicPeriodId} />
              <input type="hidden" name="targetRuleVersionId" value={targetRuleVersionId} />
              <Button type="submit">Crear lote</Button>
            </form>
          </Card>
        </>
      ) : (
        <Card>
          <Alert tone="info">
            {
              "Ingresa el periodo y la versión de regla para obtener una vista previa real. El preview es obligatorio. Si el backend no expone lectura adicional de reglas o lotes, esta pantalla opera a través de la vista previa como flujo principal."
            }
          </Alert>
        </Card>
      )}
    </Container>
  );
}
