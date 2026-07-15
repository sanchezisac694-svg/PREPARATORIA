# Estados y flujos

Solo se documentan estados y transiciones explícitas o inmediatamente condicionadas por el Plan Maestro. Toda transición no listada queda prohibida hasta validación.

## Admisión

| Estado | Transición permitida | Actor | Condición | Auditoría |
|---|---|---|---|---|
| BORRADOR | REGISTRO_COMPLETO | Aspirante | Datos mínimos completos | Fecha/cuenta |
| REGISTRO_COMPLETO | DOCUMENTOS_PENDIENTES o PAGO_PENDIENTE | Sistema | Requisitos/cargo aplicables | Cambio de estado |
| DOCUMENTOS_PENDIENTES | DOCUMENTOS_EN_REVISION | Aspirante/Sistema | Archivos cargados | Archivo/fecha |
| DOCUMENTOS_EN_REVISION | DOCUMENTOS_APROBADOS o CORRECCION_REQUERIDA | Control escolar | Revisión concluida | Responsable/motivo |
| PAGO_PENDIENTE | PAGO_EN_REVISION o PAGO_CONFIRMADO | Usuario/finanzas | Comprobante o efectivo | Operación financiera |
| EXAMEN_PROGRAMADO | RESULTADO_CAPTURADO o AUSENTE | Maestro autorizado | Examen físico programado | Resultado/responsable |
| RESULTADO_CAPTURADO | DECISION_PENDIENTE | Sistema/control escolar | Puntaje final disponible | Fecha |
| DECISION_PENDIENTE | ACEPTADO o RECHAZADO | Control escolar | Expediente analizado | Responsable/motivo |
| ACEPTADO | PREINSCRITO o NO_INSCRITO | Control escolar | Resultado publicado; reglas P-003 pendientes | Historial completo |
| RECHAZADO | Final salvo corrección autorizada | Control escolar | Decisión válida | No sobrescribir |
| Cualquier activo | CANCELADO | Control escolar | Causa documentada | Responsable/causa |

**Prohibido:** que el maestro acepte/rechace; que el aspirante modifique resultado; convertir a alumno sin ACEPTADO; sobrescribir historial; automatizar lista de espera/reasignación.

## Alumno e inscripción

| Estado | Transición permitida | Actor | Condición | Auditoría |
|---|---|---|---|---|
| PREINSCRITO | INSCRITO | Control escolar/servicio | Aceptación, requisitos y pago confirmados | Transacción y folio |
| INSCRITO | ACTIVO | Control escolar/Sistema | Inicio del periodo | Fecha/periodo |
| ACTIVO | BAJA_TEMPORAL | Control escolar | Reprobación que impide avance | Motivo/historial |
| ACTIVO | BAJA_DEFINITIVA | Control escolar | Retiro o expulsión documentada | Motivo/autorización |
| BAJA_TEMPORAL | ACTIVO/avance autorizado | Control escolar | Recursamiento y materias pendientes acreditadas | Intentos conservados |
| ACTIVO | EGRESADO | — | `PENDIENTE_VALIDACION` P-014 | — |

**Prohibido:** avanzar con materias no acreditadas; mezclar semestres; eliminar intentos anteriores; asignar grupo automáticamente en V1. El acceso en bajas depende de P-015.

## Estados financieros

Los catálogos siguientes son **SUGERIDOS** por el Plan Maestro (Sección 15.5); no son todavía una máquina de estados institucional aprobada.

| Objeto | Estados sugeridos | Clasificación del estado | Referencia |
|---|---|---|---|
| Cargo | PENDIENTE, PARCIAL, PAGADO, VENCIDO, CANCELADO | SUGERIDO | Sección 15.5 |
| Voucher | VIGENTE, UTILIZADO, VENCIDO, CANCELADO | SUGERIDO | Sección 15.5 |
| Comprobante | CARGADO, EN_REVISION, APROBADO, RECHAZADO, SUSTITUIDO | SUGERIDO | Sección 15.5 |
| Pago | REGISTRADO, CONFIRMADO, CANCELADO, REEMBOLSADO | SUGERIDO | Sección 15.5 |
| Recibo | VIGENTE, CANCELADO, REEMPLAZADO | SUGERIDO | Sección 15.5 |

### Transiciones financieras

| Transición o relación | Clasificación | Fundamento | Condición antes de implementar | Referencia |
|---|---|---|---|---|
| Comprobante cargado → revisión → aprobación o rechazo | CONFIRMADO | El flujo de transferencia define carga, revisión y decisión | Actor exacto según P-011 | Sección 15.3 |
| Comprobante rechazado → sustitución por otro archivo | CONFIRMADO | El usuario puede sustituir un comprobante rechazado | Conservar rechazado e historial | Sección 15.3 |
| Aprobación de comprobante → crear pago → aplicar cargo → emitir recibo | CONFIRMADO | Secuencia expresa del flujo de transferencia | Servicio seguro y actor P-011 | Sección 15.3 |
| Registro de efectivo → aplicar cargo → emitir recibo | CONFIRMADO | Secuencia expresa del flujo de efectivo | Servicio seguro y actor P-011 | Sección 15.2 |
| Cargo PENDIENTE → PAGADO | INFERIDO_TECNICAMENTE | Parece necesario para reflejar saldo liquidado, pero el Plan no fija transición formal | Aprobar máquina de estados; no usar aún como criterio definitivo | Secciones 15.4–15.5 |
| Voucher VIGENTE → UTILIZADO | INFERIDO_TECNICAMENTE | Parece necesario al consumir el folio, pero la transición no se define expresamente | Aprobar vigencia/consumo; no usar aún como criterio definitivo | Sección 15.5 |
| Cualquier objeto → CANCELADO | PENDIENTE_VALIDACION | Los estados existen como sugerencia, pero faltan autorización y condiciones | Resolver responsables, causas y efectos | Sección 15.5 y Sección 31, P-011/P-012 |
| Pago CONFIRMADO → REEMBOLSADO | PENDIENTE_VALIDACION | El estado está sugerido, no el procedimiento | Aprobar reembolso, segregación y conciliación | Sección 15.5 y Sección 31, P-011 |

Actor financiero exacto: `PENDIENTE_VALIDACION` P-011. Ninguna transición inferida forma parte todavía de un criterio definitivo de aceptación.

## Documentos

Estados operativos confirmados: pendiente/cargado, en revisión, aprobado, rechazado o corrección requerida para archivos; solicitado, emitido, cancelado y reemitido/reemplazado para documentos oficiales. El Plan no fija un catálogo final de códigos.

- Usuario carga o solicita; control escolar revisa y emite.
- Rechazo requiere motivo visible.
- Emisión exige datos vigentes, formato aprobado y folio único.
- Cancelación nunca borra el original; reemisión vincula reemplazo.
- Publicación/descarga se limita por RLS o URL firmada.

## Asistencia

| Estado | Uso/transición | Actor | Condición/auditoría |
|---|---|---|---|
| ASISTENCIA | Presente | Maestro | Carga y sesión asignadas |
| FALTA | Ausente sin justificación | Maestro | Sesión impartida |
| RETARDO | Llegada >15 min en primera hora | Maestro | No disponible después de primera hora |
| FALTA_JUSTIFICADA | Sustituye clasificación tras aprobación | Prefecto | Evidencia, plazo, resolución y responsable |
| CLASE_CANCELADA | Sesión no impartida | Maestro/autorizado | Causa; no genera faltas ni denominador |
| NO_APLICA | No debía participar | Autorizado | Causa válida |

Tres RETARDO por materia generan una falta equivalente sin borrar retardos. Una corrección conserva antes/después, causa y responsable. El tratamiento de llegada tardía posterior y faltas justificadas en el 10 % depende de P-007/P-008.

## Alertas entre clases

Estados de resolución: LOCALIZADO, PERMISO_AUTORIZADO, SALIÓ_DEL_PLANTEL, ACTIVIDAD_INSTITUCIONAL, ERROR_DE_CAPTURA y NO_LOCALIZADO. Maestro/prefectura reciben la alerta; prefectura registra resolución. La alerta es preventiva, no prueba definitiva.

## Resultado académico

| Resultado | Condición |
|---|---|
| AC | Final original ≥6.0 y al menos dos unidades ≥6.0. |
| NA | Final original <6.0 o menos de dos unidades ≥6.0. |

Captura→cierre→publicación son eventos separados. Después del cierre solo se corrige mediante autorización y auditoría. AC/NA no se modifica directamente: se deriva de valores e historial válidos.

## Referencia precisa al Plan Maestro

| Dominio documentado | Referencia fuente |
|---|---|
| Estados y flujo de admisión | Secciones 9.1–9.3 |
| Estados del alumno e inscripción | Secciones 10.1–10.4; Sección 31, P-014/P-015 |
| Estados y transiciones financieras | Secciones 15.2–15.5; Sección 31, P-011–P-013 |
| Documentos | Secciones 16.2–16.4; Sección 31, P-004/P-010/P-012/P-019 |
| Estados de asistencia | Secciones 14.1–14.5 |
| Alertas entre clases | Sección 14.6 |
| Resultado AC/NA, cierre y corrección | Secciones 13.1–13.4 y Anexo C |
