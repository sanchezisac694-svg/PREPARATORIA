# Pendientes institucionales P-001–P-020

Las clasificaciones son de preparación del proyecto y no resuelven el contenido institucional. `BD`, `UI` y `Seg.` describen impacto, no diseño físico.

| ID | Descripción / decisión requerida | Área responsable | Módulos | Riesgo | Impacto BD / UI / Seg. | Clasificación | Fase límite |
|---|---|---|---|---|---|---|---|
| P-001 | Nombre, logotipo, dirección y dominio oficiales | Dirección/TI | Sitio, correo, documentos | Identidad institucional inconsistente | BD: configuración; UI: branding; Seg.: dominio/correo | CONFIGURABLE_POSTERIORMENTE | 4 |
| P-002 | Puntajes máximo y mínimo de admisión | Control escolar | Admisión/reportes | Decisiones incorrectas | BD: escala/regla; UI: captura; Seg.: autorización | BLOQUEANTE | 5 |
| P-003 | Destino del lugar si aceptado no se inscribe | Dirección/control escolar | Admisión/inscripción | Cupos inconsistentes | BD: estados/cupo; UI: flujo; Seg.: autorización | BLOQUEANTE | 5 |
| P-004 | Lista definitiva de documentos de ingreso | Control escolar/privacidad | Expediente/admisión | Expediente incompleto | BD: catálogo; UI: checklist; Seg.: datos sensibles | BLOQUEANTE | 5 |
| P-005 | Materias y claves por semestre/área | Control escolar | Núcleo/calificaciones/horarios | Plan incorrecto | BD: catálogo/versiones; UI: oferta; Seg.: bajo | BLOQUEANTE | 6 |
| P-006 | Equivalencia grupos A–E con áreas de quinto | Control escolar | Grupos/horarios | Asignación errónea | BD: relación configurable; UI: selección; Seg.: bajo | BLOQUEANTE | 6 |
| P-007 | Tratamiento de llegada tarde en clases posteriores | Prefectura | Asistencia | Criterios dispares | BD: estado/corrección; UI: lista; Seg.: auditoría | BLOQUEANTE | 8 |
| P-008 | Si justificadas cuentan en límite de 10 % | Control escolar/prefectura | Asistencia/calificaciones | Derecho a examen incorrecto | BD: regla; UI: porcentaje; Seg.: historial | BLOQUEANTE | 8 |
| P-009 | Ventanas, cierres y correcciones | Control escolar | Calificaciones | Cambios fuera de plazo | BD: periodos/versiones; UI: bloqueo; Seg.: autorización | BLOQUEANTE | 9 |
| P-010 | Firma física, digitalizada o aceptación del tutor | Dirección/jurídico | Inscripción/documentos | Evidencia inválida | BD: evidencia; UI: firma; Seg.: consentimiento | BLOQUEANTE | 10 |
| P-011 | Quién registra efectivo y valida transferencias | Finanzas/dirección | Pagos/permisos | Fraude o falta de segregación | BD: responsable; UI: acciones; Seg.: rol crítico | BLOQUEANTE | 3 (modelo), 11 (operación) |
| P-012 | Formato, serie y firma de recibos/documentos | Finanzas/control escolar | Pagos/documentos | Documentos no oficiales | BD: folio/serie; UI: vista; Seg.: emisión | BLOQUEANTE | 11/12 |
| P-013 | Otros conceptos de cobro | Finanzas | Pagos | Catálogo incompleto | BD: catálogo; UI: selección; Seg.: autorización | CONFIGURABLE_POSTERIORMENTE | 11 |
| P-014 | Estado EGRESADO y procedimiento | Control escolar | Alumno/reportes | Historial final ambiguo | BD: estado/transición; UI: perfil; Seg.: acceso | NO_BLOQUEANTE | 6, antes de egreso |
| P-015 | Acceso en bajas temporal/definitiva | Dirección/control escolar | Auth/portales | Exposición o bloqueo indebido | BD: estado/vigencia; UI: módulos; Seg.: RLS | BLOQUEANTE | 3 |
| P-016 | Funciones exactas de tutor/asesor de grupo | Dirección/control escolar | Grupos/permisos/reportes | Privilegios ambiguos | BD: asignación; UI: acciones; Seg.: RLS | BLOQUEANTE | 3/6 |
| P-017 | Matrícula, concurrencia y crecimiento | Dirección/TI | Rendimiento/costos | Capacidad insuficiente | BD: índices/volumen; UI: paginación; Seg.: límites | BLOQUEANTE | 1 |
| P-018 | RPO, RTO y retención | Dirección/TI | Respaldo/continuidad | Pérdida o recuperación tardía | BD: copias; UI: N/A; Seg.: conservación | BLOQUEANTE | 1/16 |
| P-019 | Privacidad, consentimiento y conservación | Privacidad/jurídico | Todos con datos personales | Incumplimiento y exposición | BD: retención; UI: avisos; Seg.: acceso/borrado | BLOQUEANTE | 2/3 |
| P-020 | Presupuesto, equipo y fecha objetivo | Dirección/patrocinador | Proyecto/despliegue | Plan inviable | BD/UI/Seg.: alcance y capacidad | BLOQUEANTE | 1 |

## Bloqueos por disciplina

- **Identidad:** P-015, P-016, P-019.
- **Modelo de datos definitivo:** P-002–P-012, P-014–P-019 según dominio; especialmente P-004–P-009.
- **RLS:** P-011, P-015, P-016, P-019.
- **Interfaz:** P-001, P-004, P-007–P-010, P-012, P-015, P-016.
- **Pagos:** P-011, P-012; P-013 es configurable posteriormente.
- **Documentos:** P-001, P-004, P-010, P-012, P-019.
- **Despliegue:** P-001, P-017, P-018, P-020.
