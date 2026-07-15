# Reglas de negocio

Estados: `CONFIRMADA`, `PENDIENTE`, `RECOMENDADA`. Los códigos `RN-*` son referencias documentales internas, no identificadores de implementación.

| Código | Dominio | Regla | Estado | Fuente | Módulos afectados | Casos de prueba |
|---|---|---|---|---|---|---|
| RN-ID-001 | Identidad | Una persona conserva identidad y expediente únicos al cambiar o acumular roles. | CONFIRMADA | 1.3, 6.1 | Auth, admisión, alumno | Conversión sin duplicado; roles múltiples |
| RN-ID-002 | Identidad | CURP será única cuando exista y esté validada; matrícula y folios no se reutilizan. | CONFIRMADA | 20.3 | Identidad, documentos | Duplicados rechazados |
| RN-ID-003 | Identidad | Roles y vínculos conservan vigencia, responsable, motivo e historial. | CONFIRMADA | 6.3 | Auth, tutor | Revocación no borra historial |
| RN-ADM-001 | Admisión | El examen es físico; el sistema solo programa y registra asistencia/resultado final. | CONFIRMADA | 9.1–9.3 | Admisión | Sin reactivos; captura autorizada |
| RN-ADM-002 | Admisión | Maestro captura resultado; control escolar decide y publica separadamente. | CONFIRMADA | 9.1–9.3 | Admisión | Aspirante no edita; no ve antes de publicar |
| RN-ADM-003 | Admisión | No hay lista de espera ni reasignación automática en V1. | CONFIRMADA | 9.3 | Admisión | Sin transición automática |
| RN-ADM-004 | Admisión | Umbral y destino de lugares no inscritos requieren decisión institucional. | PENDIENTE | P-002, P-003 | Admisión | Casos tras aprobación |
| RN-ADM-005 | Admisión | El historial de estados se agrega; nunca se sobrescribe. | CONFIRMADA | 9.3 | Admisión, auditoría | Corrección conserva anterior |
| RN-INS-001 | Inscripción | Solo ACEPTADO vigente y con requisitos puede iniciar preinscripción. | CONFIRMADA | 10.1 | Admisión, inscripción | Rechazado bloqueado |
| RN-INS-002 | Inscripción | Pago confirmado y requisitos vigentes condicionan inscripción; grupo es manual. | CONFIRMADA | 10.1 | Inscripción, pagos | Sin pago/grupo inválido bloqueados |
| RN-INS-003 | Inscripción | Reprobación bloquea el siguiente semestre y no se mezclan semestres. | CONFIRMADA | 10.2, 10.4 | Inscripción, académico | Materia pendiente bloquea avance |
| RN-INS-004 | Inscripción | Recursamiento crea un intento nuevo y conserva calificaciones previas. | CONFIRMADA | 10.4 | Académico | Dos intentos visibles |
| RN-INS-005 | Inscripción | Tipo de firma del tutor y acceso durante bajas están por validar. | PENDIENTE | P-010, P-015 | Inscripción, portales | Pruebas posteriores |
| RN-ACA-001 | Académico | El plan tiene seis semestres secuenciales y materias fijas. | CONFIRMADA | 11.1 | Núcleo, inscripción | Sin avance no secuencial |
| RN-ACA-002 | Académico | Planes y oferta se versionan; cambios no alteran históricos. | CONFIRMADA | 11.4 | Núcleo | Periodo anterior permanece |
| RN-ACA-003 | Académico | Áreas se asignan desde quinto; equivalencia de grupos es configurable. | PENDIENTE | 11.2, P-006 | Áreas, grupos | Asignación tras catálogo |
| RN-ACA-004 | Académico | Capacidad máxima inicial de grupo: 40, salvo autorización registrada. | CONFIRMADA | 11.3 | Grupos | Cupo 41 rechazado/autorizado |
| RN-ACA-005 | Académico | Cada grupo tiene tutor y asesor; funciones exactas pendientes. | PENDIENTE | 11.3, P-016 | Grupos, permisos | Acciones no habilitadas |
| RN-HOR-001 | Horarios | No hay solapamiento de maestro, grupo o espacio. | CONFIRMADA | 12.3 | Horarios | Conflictos rechazados |
| RN-HOR-002 | Horarios | Jornada inicial 07:00–14:20, clase de 50 min y receso 09:30–10:00; datos configurables. | CONFIRMADA | 12.1 | Horarios | Límites y receso |
| RN-HOR-003 | Horarios | Puede haber varias sesiones de una materia por día, cada una con identidad propia. | CONFIRMADA | 12.1 | Horarios, asistencia | Sesiones múltiples únicas |
| RN-HOR-004 | Horarios | Sustituciones quedan fuera; sesión cancelada no genera faltas. | CONFIRMADA | 12.3 | Horario, asistencia | Cancelación excluye lista |
| RN-CAL-001 | Calificaciones | Escala 0–10, aprobatoria desde 6.0, tres unidades y final manual. | CONFIRMADA | 13.1 | Calificaciones | Límites y tres unidades |
| RN-CAL-002 | Calificaciones | AC exige final original ≥6 y al menos dos unidades ≥6; 5-5-10 es NA. | CONFIRMADA | 13.2 | Calificaciones, reinscripción | Casos 5-5-10, 6-6-5.9 |
| RN-CAL-003 | Calificaciones | Valores <6 no suben a aprobatorio; original y oficial se conservan separados. | CONFIRMADA | 13.3 | Calificaciones, documentos | 5.95 permanece 5.95 |
| RN-CAL-004 | Calificaciones | Para aprobatorias: .00–.25 baja a entero, >.25–.75 a .50, >.75 al siguiente entero. | CONFIRMADA | 13.3, Anexo C | Calificaciones | Límites .25/.26/.75/.76 |
| RN-CAL-005 | Calificaciones | Captura, cierre y publicación son independientes; corrección cerrada exige autorización e historial. | CONFIRMADA | 13.4 | Calificaciones | Fuera de ventana bloqueado |
| RN-CAL-006 | Calificaciones | Ventanas y responsables exactos se configuran tras P-009. | PENDIENTE | P-009 | Calificaciones | Casos tras decisión |
| RN-ASI-001 | Asistencia | Registro único por alumno+carga+fecha+sesión. | CONFIRMADA | 14.1 | Asistencia | Duplicado rechazado |
| RN-ASI-002 | Asistencia | Retardo formal: >15 min solo en primera hora. | CONFIRMADA | 14.2 | Asistencia | No disponible después |
| RN-ASI-003 | Asistencia | Tres retardos por materia generan falta equivalente sin borrar retardos. | CONFIRMADA | 14.2 | Asistencia | Tercer evento y trazabilidad |
| RN-ASI-004 | Asistencia | Cuarto retardo general de primera hora notifica tutor y reinicia contador. | CONFIRMADA | 14.3 | Asistencia, avisos | Eventos 1–4 |
| RN-ASI-005 | Asistencia | Pérdida de derecho al superar 10 %; canceladas no cuentan. | CONFIRMADA | 14.4 | Asistencia, académico | 10 % vs >10 % |
| RN-ASI-006 | Asistencia | Efecto de justificadas y tardanza posterior está pendiente. | PENDIENTE | P-007, P-008 | Asistencia | Casos tras decisión |
| RN-ASI-007 | Asistencia | Justificantes se presentan inicialmente hasta un día después y prefectura resuelve. | CONFIRMADA | 14.5 | Asistencia, documentos | Plazo/evidencia/resolución |
| RN-ASI-008 | Asistencia | Presente anterior + ausente actual genera alerta preventiva y resolución auditada. | CONFIRMADA | 14.6 | Asistencia, prefectura | Detección y estados de resolución |
| RN-PAG-001 | Pagos | Ficha, inscripción y reinscripción cuestan inicialmente $300 MXN; no hay mensualidades. | CONFIRMADA | 15.1 | Pagos | Monto/concepto correcto |
| RN-PAG-002 | Pagos | Cargo, voucher, comprobante, pago, aplicación y recibo son entidades separadas. | CONFIRMADA | 15.4 | Pagos | Rechazo no liquida cargo |
| RN-PAG-003 | Pagos | Voucher no acredita pago; recibo solo se emite al confirmar y aplicar pago. | CONFIRMADA | 15.2–15.3 | Pagos, inscripción | Flujo efectivo/transferencia |
| RN-PAG-004 | Pagos | Pago confirmado no se elimina; cancelación/reembolso conservan historial. | CONFIRMADA | 20.3 | Pagos, auditoría | Cancelación lógica |
| RN-PAG-005 | Pagos | Responsables, formatos y conceptos adicionales dependen de P-011–P-013. | PENDIENTE | P-011–P-013 | Pagos, permisos | Sin acciones no autorizadas |
| RN-DOC-001 | Documentos | Archivos en storage privado; no hay URL pública permanente. | CONFIRMADA | 16.4 | Expediente, documentos | Acceso anónimo rechazado |
| RN-DOC-002 | Documentos | Se valida extensión, MIME, tamaño y, cuando sea posible, contenido malicioso. | CONFIRMADA | 16.4 | Documentos | Archivo inválido rechazado |
| RN-DOC-003 | Documentos | Folio único; emisión guarda versión; cancelación no borra y enlaza reemplazo. | CONFIRMADA | 16.3–16.4 | Documentos | Folio no reutilizado |
| RN-DOC-004 | Documentos | Lista, firma, formato y conservación dependen de P-004/P-010/P-012/P-019. | PENDIENTE | Pendientes citados | Documentos | No emitir plantilla final |
| RN-SEG-001 | Seguridad | RLS aplica por usuario, rol, vínculo y carga; frontend no es barrera. | CONFIRMADA | 6.3, 21 | Todos | Pruebas negativas por rol |
| RN-SEG-002 | Seguridad | MFA obligatorio para administrativos/técnicos; secretos fuera del cliente. | CONFIRMADA | 6.2, 21 | Admin | MFA y ausencia de service key |
| RN-SEG-003 | Seguridad | Operaciones críticas usan servicio seguro, validación y transacción. | CONFIRMADA | 5.3, 21 | Conversión, pagos, documentos | Fallo atómico |
| RN-AUD-001 | Auditoría | Identidad, estados, calificaciones, asistencia, pagos, documentos, roles y configuración son auditables. | CONFIRMADA | 21.4 | Todos | Evento con antes/después |
| RN-AUD-002 | Auditoría | Historial se agrega y no simula vigencia sobrescribiendo eventos. | CONFIRMADA | 20.3 | Todos | Versión anterior consultable |
| RN-RES-001 | Respaldos | Copias automáticas más exportación externa y prueba trimestral son propuesta a validar. | RECOMENDADA | 23.1 | Continuidad | Restauración aislada |
| RN-RES-002 | Respaldos | RPO, RTO y retención requieren P-018. | PENDIENTE | P-018 | Continuidad | Prueba tras decisión |
| RN-RES-003 | Respaldos | Sin conexión se usan formatos temporales y captura posterior auditada; no hay offline completo. | CONFIRMADA | 23.2 | Asistencia, pagos | Reconciliación sin duplicado |
