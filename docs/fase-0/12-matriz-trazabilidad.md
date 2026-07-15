# Matriz de trazabilidad

Cada requisito del Plan Maestro aparece una vez. `Prueba` es la evidencia mínima propuesta; no implica implementación. Estado usa `C` = confirmado y `CP` = confirmado con pendiente institucional.

| Requisito | Regla | Actor | Módulo | Fase | Prueba | Criterio resumido | Pendiente | Estado |
|---|---|---|---|---:|---|---|---|---|
| RF-AUT-001 | RN-ID-001 | Aspirante | Auth | 2 | Integración registro | Correo verificado | — | C |
| RF-AUT-002 | RN-ID-002 | Alumno | Auth | 2 | Seguridad enumeración | Matrícula resuelve sin filtrar existencia | — | C |
| RF-AUT-003 | RN-ID-003 | Admin | Roles | 2–3 | Roles múltiples | Cambio de contexto sin duplicado | — | C |
| RF-AUT-004 | RN-ID-003/RN-SEG-001 | Tutor | Vínculos | 2–3 | RLS negativa | No ve alumno no vinculado | P-016/019 | CP |
| RF-AUT-005 | RN-SEG-002 | Administrativo | MFA | 2 | Auth MFA | Segundo factor obligatorio | — | C |
| RF-AUT-006 | RN-SEG-002 | Usuario | Auth | 2 | Recuperación | Enlace temporal y único | — | C |
| RF-AUT-007 | RN-ID-003 | Admin | Cuentas | 2–3 | Bloqueo | Sin sesión; conserva auditoría | P-015 | CP |
| RF-ADM-001 | RN-ADM-001 | Control escolar | Convocatoria | 5 | Regla de unicidad | Una activa por periodo | — | C |
| RF-ADM-002 | RN-ADM-005 | Aspirante | Solicitud | 5 | E2E borrador | Guarda y reanuda | — | C |
| RF-ADM-003 | RN-DOC-001/004 | Aspirante | Expediente | 5 | Archivo privado | Estado de revisión | P-004/019 | CP |
| RF-ADM-004 | RN-PAG-001/003 | Aspirante | Ficha | 5 | Folio/monto | Núcleo mínimo genera voucher $300 único; confirmación queda en F11/F16 | — | C |
| RF-ADM-005 | RN-ADM-001 | Control escolar | Examen | 5 | Flujo físico | Sin banco de preguntas | — | C |
| RF-ADM-006 | RN-ADM-002/004 | Maestro | Resultado | 5 | Autorización | Solo maestro autorizado | P-002 | CP |
| RF-ADM-007 | RN-ADM-002/004 | Control escolar | Decisión | 5 | Estados/auditoría | Fecha, motivo, responsable | P-002 | CP |
| RF-ADM-008 | RN-ADM-002 | Control escolar | Publicación | 5 | Visibilidad | Invisible antes de publicar | — | C |
| RF-ADM-009 | RN-ID-001/RN-INS-001 | Control escolar | Conversión | 10 | Transaccional | Sin duplicar persona/cuenta | — | C |
| RF-INS-001 | RN-INS-001 | Control escolar | Preinscripción | 10 | Estado inválido | Solo ACEPTADO vigente | P-003 | CP |
| RF-INS-002 | RN-INS-002/RN-PAG-001 | Control escolar | Inscripción | 10/11/16 | Integración pago | F10 crea cargo y consulta; F11 confirma; F16 cierra E2E | — | C |
| RF-INS-003 | RN-INS-002/RN-ACA-004 | Control escolar | Grupo | 10 | Capacidad | Asignación manual válida | — | C |
| RF-INS-004 | RN-DOC-003/004 | Control escolar | Comprobante | 10–12 | Documento | Folio y datos completos | P-012 | CP |
| RF-INS-005 | RN-INS-003 | Control escolar | Reinscripción | 10 | Bloqueo académico | Informa materia NA | — | C |
| RF-INS-006 | RN-ID-003/RN-INS-005 | Control escolar | Estados alumno | 10 | Historial | Motivo/fecha/responsable | P-014/015 | CP |
| RF-INS-007 | RN-INS-004 | Control escolar | Recursamiento | 10 | Historial intentos | No sobrescribe intento | — | C |
| RF-ACA-001 | RN-ACA-001 | Control escolar | Semestres | 6 | Secuencia | Solo avance ordenado | — | C |
| RF-ACA-002 | RN-ACA-002 | Control escolar | Materias | 6 | Inactivación | Histórico permanece | P-005 | CP |
| RF-ACA-003 | RN-ACA-002 | Control escolar | Planes | 6 | Versionado | Periodos previos intactos | — | C |
| RF-ACA-004 | RN-ACA-003 | Control escolar | Áreas | 6 | Asignación | Desde quinto | P-005/006 | CP |
| RF-ACA-005 | RN-ACA-004 | Control escolar | Grupos | 6 | Límite cupo | >40 requiere autorización | — | C |
| RF-ACA-006 | RN-ACA-005 | Control escolar | Tutor/asesor | 6 | Vigencia | Historial de asignación | P-016 | CP |
| RF-ACA-007 | RN-INS-003/004 | Control escolar | Recursamiento | 6/10 | Semestres | No mezcla oferta | — | C |
| RF-HOR-001 | RN-HOR-001 | Control escolar | Cargas | 7 | Conflictos | Maestro/grupo/espacio únicos | — | C |
| RF-HOR-002 | RN-SEG-001 | Prefecto | Horario grupo | 7 | Permiso | Visible a rol autorizado | — | C |
| RF-HOR-003 | RN-SEG-001 | Maestro | Horario docente | 7 | RLS negativa | Solo cargas propias | — | C |
| RF-HOR-004 | RN-SEG-001 | Alumno/tutor | Horario alumno | 7/14 | RLS vínculo | Solo propio/vinculado | P-016 | CP |
| RF-HOR-005 | RN-HOR-003 | Control escolar | Sesiones | 7 | Unicidad | Varias sesiones con ID único | — | C |
| RF-HOR-006 | RN-HOR-004 | Maestro | Cancelación | 7–8 | Integración asistencia | Sin faltas | — | C |
| RF-HOR-007 | RN-ACA-005 | Alumno/admin | Grupo | 7/14 | Visibilidad | Responsables vigentes | P-016 | CP |
| RF-CAL-001 | RN-CAL-001 | Maestro | Unidades | 9 | Estructura | U1/U2/U3 configurables | — | C |
| RF-CAL-002 | RN-SEG-001 | Maestro | Captura | 9 | RLS negativa | Rechaza carga ajena | — | C |
| RF-CAL-003 | RN-CAL-001 | Maestro | Final | 9 | Flujo manual | No confirma automáticamente | — | C |
| RF-CAL-004 | RN-CAL-002 | Sistema | Acreditación | 9 | Casos límite | 5-5-10 y 6-6-5.9 NA | — | C |
| RF-CAL-005 | RN-CAL-003/004 | Sistema | Redondeo | 9 | Tabla Anexo C | 5.95 no sube | — | C |
| RF-CAL-006 | RN-CAL-005/006 | Control escolar | Cierre | 9 | Autorización | Corrección solo por flujo | P-009 | CP |
| RF-CAL-007 | RN-CAL-005 | Control escolar | Publicación | 9 | Visibilidad | Captura separada | P-009 | CP |
| RF-CAL-008 | RN-AUD-001/002 | Control escolar | Historial | 9 | Auditoría | Antes/después consultable | — | C |
| RF-ASI-001 | RN-ASI-001 | Maestro | Lista | 8 | Lista oficial | Solo activos inscritos | — | C |
| RF-ASI-002 | RN-ASI-002 | Maestro | Retardo | 8 | Horario | Solo primera hora >15 min | P-007 | CP |
| RF-ASI-003 | RN-ASI-003 | Sistema | Equivalencia | 8 | Contador | 3 generan falta sin borrar | — | C |
| RF-ASI-004 | RN-ASI-004 | Sistema | Notificación | 8/13 | Secuencia 1–4 | Cuarto avisa y reinicia | — | C |
| RF-ASI-005 | RN-ASI-005/006 | Sistema | Porcentaje | 8 | Límite | Cancelada excluida | P-008 | CP |
| RF-ASI-006 | RN-ASI-006/007 | Tutor/prefecto | Justificante | 8 | Flujo/evidencia | Resolución auditada | P-008/019 | CP |
| RF-ASI-007 | RN-ASI-008 | Maestro/prefecto | Alertas | 8 | Detección | Resolución disponible | — | C |
| RF-ASI-008 | RN-HOR-004 | Maestro | Cancelación | 8 | Sesión | No genera faltas | — | C |
| RF-PAG-001 | RN-PAG-001/002 | Finanzas | Cargo | 5/10/11 | Saldo | Núcleo mínimo crea cargo; operación completa mantiene saldo | P-013 | CP |
| RF-PAG-002 | RN-PAG-003 | Usuario | Voucher | 5/10 | Unicidad | Núcleo mínimo emite folio no repetido | — | C |
| RF-PAG-003 | RN-PAG-003/005 | Finanzas | Efectivo | 11 | Transacción | Pago+recibo atómicos | P-011/012 | CP |
| RF-PAG-004 | RN-DOC-001 | Usuario | Comprobante | 11 | Privacidad | Archivo privado en revisión | P-019 | CP |
| RF-PAG-005 | RN-PAG-005 | Finanzas | Validación | 11 | Permiso | Solo rol autorizado | P-011 | CP |
| RF-PAG-006 | RN-PAG-002/003 | Servicio | Aplicación | 11 | Integridad | Saldo consistente | — | C |
| RF-PAG-007 | RN-PAG-003/004 | Servicio | Recibo | 11–12 | Cancelación | Original permanece | P-012 | CP |
| RF-PAG-008 | RN-AUD-001 | Finanzas | Auditoría | 11 | Eventos | Todo cambio rastreable | P-011 | CP |
| RF-DOC-001 | RN-DOC-001 | Usuario | Storage | 12 | Seguridad URL | Acceso anónimo falla | P-019 | CP |
| RF-DOC-002 | RN-DOC-002/004 | Control escolar | Revisión | 12 | Estados | Motivo visible | P-004 | CP |
| RF-DOC-003 | RN-DOC-003 | Alumno/tutor | Solicitud | 12 | Flujo | Estado y seguimiento | — | C |
| RF-DOC-004 | RN-DOC-003 | Servicio | Folios | 12 | Unicidad | Cancelado no se reutiliza | P-012 | CP |
| RF-DOC-005 | RN-DOC-003/004 | Servicio | Generación | 12 | Versión | PDF emitido conservado | P-001/012 | CP |
| RF-DOC-006 | RN-DOC-004/RN-SEG-001 | Usuario externo | Verificación | 12 | Privacidad | QR no revela de más | P-012/019 | CP |
| RF-DOC-007 | RN-DOC-003 | Control escolar | Cancelación | 12 | Historial | Causa y reemplazo | — | C |
| RNF-001 | RN-RES-002 | Institución | Disponibilidad | 16 | Monitoreo mensual | 99.5 % sujeto a plan | P-017/020 | CP |
| RNF-002 | — | Usuario | Rendimiento | 16 | Carga | P95 <2.5 s a carga objetivo | P-017 | CP |
| RNF-003 | — | Equipo técnico | Escalabilidad | 1/16 | Carga/volumen | Crece sin rediseño total | P-017 | CP |
| RNF-004 | RN-SEG-001/002/003 | Todos | Seguridad | 3/16 | Suite negativa | Accesos indebidos fallan | P-019 | CP |
| RNF-005 | RN-SEG-001 | Todos | Privacidad | 3/16 | Revisión campos | Solo mínimo necesario | P-019 | CP |
| RNF-006 | — | Usuarios piloto | Usabilidad | 14/17 | Tareas UAT | Tasa de éxito acordada | P-020 | CP |
| RNF-007 | — | Usuarios | Accesibilidad | 4/16 | Auditoría a11y | Teclado/etiquetas/contraste | — | C |
| RNF-008 | — | Usuarios | Compatibilidad | 16 | Matriz navegador | Navegadores acordados | — | C |
| RNF-009 | RN-AUD-001/002 | Auditor | Trazabilidad | 3/16 | Cobertura eventos | 100 % críticos auditados | — | C |
| RNF-010 | RN-RES-001/002 | Admin | Recuperación | 16 | Restauración | RPO/RTO documentados | P-018 | CP |
| RNF-011 | — | Equipo técnico | Mantenibilidad | 1/16 | Revisión/cobertura | Umbral acordado | P-020 | CP |
| RNF-012 | RN-ID-002/RN-AUD-002 | Sistema | Integridad | 6/16 | Restricciones/transacción | Sin huérfanos/duplicados | — | C |
| RNF-013 | — | Administrativo | Exportación | 15 | Formatos | PDF/XLSX/CSV correcto | P-012 | CP |
| RNF-014 | — | Admin | Observabilidad | 1/16 | Simulación incidente | Error y alerta visibles | — | C |

**Cobertura cruzada:** 82/82 requisitos de `02-matriz-requisitos.md`. Las reglas `—` corresponden a atributos no funcionales sin regla de negocio adicional; permanecen trazados directamente al Plan Maestro.

## Referencia precisa al Plan Maestro

| Identificadores | Referencia fuente |
|---|---|
| RF-AUT-001–007 | Sección 6.3, tabla de requisitos de autenticación |
| RF-ADM-001–009 | Sección 9.3, tabla de requisitos de admisión |
| RF-INS-001–007 | Sección 10.4, tabla de requisitos de inscripción |
| RF-ACA-001–007 | Sección 11.4, tabla de requisitos académicos |
| RF-HOR-001–007 | Sección 12.3, tabla de requisitos de horarios |
| RF-CAL-001–008 | Sección 13.4, tabla de requisitos de calificaciones; reglas en Secciones 13.1–13.4 y Anexo C |
| RF-ASI-001–008 | Sección 14.6, tabla de requisitos de asistencia; reglas en Secciones 14.1–14.6 |
| RF-PAG-001–008 | Sección 15.5, tabla de requisitos de pagos; flujos en Secciones 15.1–15.4 |
| RF-DOC-001–007 | Sección 16.4, tabla de requisitos de documentos |
| RNF-001–014 | Sección 22, tabla de requisitos no funcionales |
