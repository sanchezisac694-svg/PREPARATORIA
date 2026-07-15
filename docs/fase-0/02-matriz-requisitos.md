# Matriz completa de requisitos

Estados: `CONFIRMADO` cuando el requisito está definido; `CONFIRMADO_CON_PENDIENTE` cuando su ejecución depende de una decisión P-xxx. El Plan Maestro no asigna prioridad institucional a los RNF; por ello se usa `NO_DEFINIDA_EN_FUENTE`.

| ID | Módulo | Requisito | Actor principal | Prioridad | Criterio de aceptación | Dependencias | Fase | Validación |
|---|---|---|---|---|---|---|---:|---|
| RF-AUT-001 | Auth | Autorregistro de aspirante y perfil | Aspirante | Alta | Correo verificado antes de iniciar proceso | Auth/persona | 2 | CONFIRMADO |
| RF-AUT-002 | Auth | Acceso visible por matrícula | Alumno | Alta | Resuelve cuenta sin revelar existencia inválida | Cuenta/matrícula | 2 | CONFIRMADO |
| RF-AUT-003 | Auth | Roles múltiples con vigencia | Admin sistema | Alta | Cambio de contexto sin duplicar cuenta | Roles/auditoría | 2–3 | CONFIRMADO |
| RF-AUT-004 | Auth | Vínculo tutor-alumno | Control escolar | Alta | Tutor no consulta alumno no vinculado | Identidad/RLS | 2–3 | CONFIRMADO |
| RF-AUT-005 | Seguridad | MFA administrativo | Administrativo | Alta | Sin segundo factor no hay acceso | Auth | 2 | CONFIRMADO |
| RF-AUT-006 | Auth | Recuperación segura | Usuario | Alta | Enlace temporal, un uso, sin revelar datos | Correo/Auth | 2 | CONFIRMADO |
| RF-AUT-007 | Auth | Bloqueo sin borrar historial | Admin sistema | Alta | Cuenta inactiva sin sesión; auditoría permanece | Roles/auditoría | 2–3 | CONFIRMADO |
| RF-ADM-001 | Admisión | Configurar convocatoria | Control escolar | Alta | Una activa por periodo definido | Ciclos/configuración | 5 | CONFIRMADO |
| RF-ADM-002 | Admisión | Solicitud con progreso | Aspirante | Alta | Guardar borrador y reanudar | Auth/convocatoria | 5 | CONFIRMADO |
| RF-ADM-003 | Admisión | Documentos preliminares privados | Aspirante | Alta | Archivos privados con revisión | Storage/P-004 | 5 | CONFIRMADO_CON_PENDIENTE |
| RF-ADM-004 | Admisión/pagos | Ficha y voucher $300 | Aspirante | Alta | Folio único y vencimiento visible | Pagos/folios | 5/11 | CONFIRMADO |
| RF-ADM-005 | Admisión | Examen físico | Control escolar | Alta | Programa/asistencia sin reactivos | Convocatoria | 5 | CONFIRMADO |
| RF-ADM-006 | Admisión | Capturar resultado final | Maestro | Alta | Aspirante no puede modificar | Carga autorizada/P-002 | 5 | CONFIRMADO_CON_PENDIENTE |
| RF-ADM-007 | Admisión | Decisión aceptar/rechazar | Control escolar | Alta | Responsable, fecha y motivo | Resultado/P-002 | 5 | CONFIRMADO_CON_PENDIENTE |
| RF-ADM-008 | Admisión | Publicación separada | Control escolar | Alta | Resultado invisible antes de publicar | Decisión | 5 | CONFIRMADO |
| RF-ADM-009 | Admisión/inscripción | Conversión sin duplicado | Control escolar | Alta | Transacción crea alumno, matrícula, rol e inscripción | Identidad/pagos | 10 | CONFIRMADO |
| RF-INS-001 | Inscripción | Preinscripción de aceptados | Control escolar | Alta | Solo aceptados vigentes | Admisión | 10 | CONFIRMADO |
| RF-INS-002 | Inscripción/pagos | Cargo de inscripción $300 | Control escolar | Alta | Pago vinculado al proceso | Pagos | 10–11 | CONFIRMADO |
| RF-INS-003 | Inscripción | Asignación manual de grupo | Control escolar | Alta | Solo grupo con capacidad | Núcleo académico | 10 | CONFIRMADO |
| RF-INS-004 | Documentos | Comprobante de inscripción | Control escolar | Alta | Folio, matrícula, semestre, grupo y ciclo | Pago/grupo/P-012 | 10–12 | CONFIRMADO_CON_PENDIENTE |
| RF-INS-005 | Reinscripción | Bloquear por materias NA | Control escolar | Alta | Informa motivo del bloqueo | Calificaciones | 10 | CONFIRMADO |
| RF-INS-006 | Alumno | Cambio de estado auditado | Control escolar | Alta | Motivo, responsable y fecha; conserva anterior | Auditoría/P-014–015 | 10 | CONFIRMADO_CON_PENDIENTE |
| RF-INS-007 | Académico | Recursamiento nuevo intento | Control escolar | Alta | Ambos intentos e historial visibles | Núcleo/calificaciones | 10 | CONFIRMADO |
| RF-ACA-001 | Núcleo académico | Seis semestres ordenados | Control escolar | Alta | Sin avance no secuencial | Plan | 6 | CONFIRMADO |
| RF-ACA-002 | Núcleo académico | Catálogo de materias | Control escolar | Alta | Inactivación conserva históricos | P-005 | 6 | CONFIRMADO_CON_PENDIENTE |
| RF-ACA-003 | Núcleo académico | Versiones de plan | Control escolar | Alta | Cambio no altera periodos anteriores | Materias | 6 | CONFIRMADO |
| RF-ACA-004 | Núcleo académico | Cuatro áreas | Control escolar | Alta | Área desde quinto semestre | P-005–006 | 6 | CONFIRMADO_CON_PENDIENTE |
| RF-ACA-005 | Grupos | Apertura/capacidad/estado | Control escolar | Alta | No supera 40 sin autorización | Ciclo | 6 | CONFIRMADO |
| RF-ACA-006 | Grupos | Tutor y asesor | Control escolar | Media | Vigencia e historial | P-016 | 6 | CONFIRMADO_CON_PENDIENTE |
| RF-ACA-007 | Académico | Oferta para recursamiento | Control escolar | Alta | Alumno no mezcla semestres | Plan/ciclo | 6/10 | CONFIRMADO |
| RF-HOR-001 | Horarios | Carga maestro-materia-grupo-espacio | Control escolar | Alta | Sin conflictos | Núcleo | 7 | CONFIRMADO |
| RF-HOR-002 | Horarios | Horario por grupo | Prefecto/control escolar | Alta | Visible a roles autorizados | Cargas/RLS | 7 | CONFIRMADO |
| RF-HOR-003 | Horarios | Horario por maestro | Maestro | Alta | Solo propias salvo rol elevado | Cargas/RLS | 7 | CONFIRMADO |
| RF-HOR-004 | Horarios | Horario del alumno | Alumno/tutor | Alta | Solo grupo/vínculo propio | Inscripción/RLS | 7/14 | CONFIRMADO |
| RF-HOR-005 | Horarios | Sesiones múltiples por día | Control escolar | Alta | Identificador único por sesión | Carga | 7 | CONFIRMADO |
| RF-HOR-006 | Horarios | Cancelar sesión | Maestro/autorizado | Alta | Causa; no genera faltas | Asistencia/auditoría | 7–8 | CONFIRMADO |
| RF-HOR-007 | Grupos | Mostrar tutor/asesor | Alumno/admin | Media | Responsables visibles | RF-ACA-006/P-016 | 7/14 | CONFIRMADO_CON_PENDIENTE |
| RF-CAL-001 | Calificaciones | Tres evaluaciones | Maestro | Alta | U1–U3 sin columnas rígidas en BD | Carga/periodo | 9 | CONFIRMADO |
| RF-CAL-002 | Calificaciones | Captura solo en carga | Maestro | Alta | Fuera de carga rechazado | RLS/cargas | 9 | CONFIRMADO |
| RF-CAL-003 | Calificaciones | Final manual | Maestro | Alta | Requiere acción docente | Ventana | 9 | CONFIRMADO |
| RF-CAL-004 | Calificaciones | Condición doble AC/NA | Sistema | Alta | 5-5-10 y 6-6-5.9 son NA | Unidades/final | 9 | CONFIRMADO |
| RF-CAL-005 | Calificaciones | Redondeo institucional | Sistema | Alta | 5.95 nunca es 6 | Valor original | 9 | CONFIRMADO |
| RF-CAL-006 | Calificaciones | Cierre | Control escolar | Alta | Solo flujo autorizado corrige | P-009/auditoría | 9 | CONFIRMADO_CON_PENDIENTE |
| RF-CAL-007 | Calificaciones | Publicación | Control escolar | Alta | Captura no publica automáticamente | Cierre | 9 | CONFIRMADO |
| RF-CAL-008 | Calificaciones | Historial | Control escolar | Alta | Versión anterior auditable | Auditoría | 9 | CONFIRMADO |
| RF-ASI-001 | Asistencia | Lista por carga y sesión | Maestro | Alta | Solo inscritos activos | Horarios/RLS | 8 | CONFIRMADO |
| RF-ASI-002 | Asistencia | Retardo primera hora | Maestro | Alta | No aparece en posteriores | Horario | 8 | CONFIRMADO |
| RF-ASI-003 | Asistencia | 3 retardos = falta | Sistema | Alta | Conserva retardos originales | Auditoría | 8 | CONFIRMADO |
| RF-ASI-004 | Asistencia/avisos | Aviso al cuarto retardo | Sistema | Alta | Notifica y reinicia contador | Tutor/notificaciones | 8/13 | CONFIRMADO |
| RF-ASI-005 | Asistencia | Porcentaje por sesiones impartidas | Sistema | Alta | Cancelada no aumenta denominador | P-008 | 8 | CONFIRMADO_CON_PENDIENTE |
| RF-ASI-006 | Justificantes | Carga y resolución | Tutor/prefecto | Alta | Resolución auditada y ligada a sesiones | Storage/P-008 | 8 | CONFIRMADO_CON_PENDIENTE |
| RF-ASI-007 | Alertas | Ausencia entre clases | Maestro/prefecto | Media | Notifica y permite resolución | Asistencia previa | 8 | CONFIRMADO |
| RF-ASI-008 | Asistencia | Sesión cancelada | Maestro | Alta | No genera faltas | RF-HOR-006 | 8 | CONFIRMADO |
| RF-PAG-001 | Pagos | Cargo por concepto/periodo | Finanzas | Alta | Monto y saldo trazables | Catálogo/P-013 | 11 | CONFIRMADO_CON_PENDIENTE |
| RF-PAG-002 | Pagos | Voucher | Usuario | Alta | Folio único | Folios | 11 | CONFIRMADO |
| RF-PAG-003 | Pagos | Cobro en efectivo | Personal autorizado | Alta | Pago y recibo en transacción | P-011–012 | 11 | CONFIRMADO_CON_PENDIENTE |
| RF-PAG-004 | Pagos | Comprobante privado | Usuario | Alta | No público; en revisión | Storage | 11 | CONFIRMADO |
| RF-PAG-005 | Pagos | Aprobar/rechazar comprobante | Personal autorizado | Alta | Solo rol autorizado y motivo | P-011/RLS | 11 | CONFIRMADO_CON_PENDIENTE |
| RF-PAG-006 | Pagos | Aplicar pago a cargo | Servicio | Alta | Saldo consistente | Transacción | 11 | CONFIRMADO |
| RF-PAG-007 | Pagos | Recibo | Servicio | Alta | Folio; cancelación conserva original | P-012 | 11–12 | CONFIRMADO_CON_PENDIENTE |
| RF-PAG-008 | Auditoría | Trazabilidad financiera | Finanzas | Alta | Generación/validación/cancelación rastreables | Auditoría | 11 | CONFIRMADO |
| RF-DOC-001 | Documentos | Carga privada | Usuario | Alta | Sin acceso no autorizado | Storage/RLS | 12 | CONFIRMADO |
| RF-DOC-002 | Documentos | Revisión | Control escolar | Alta | Aprobar/rechazar/corregir con motivo | P-004 | 12 | CONFIRMADO_CON_PENDIENTE |
| RF-DOC-003 | Documentos | Solicitud oficial | Alumno/tutor | Alta | Estado y seguimiento | Identidad | 12 | CONFIRMADO |
| RF-DOC-004 | Documentos | Folio único | Servicio | Alta | No reutiliza cancelado | P-012 | 12 | CONFIRMADO_CON_PENDIENTE |
| RF-DOC-005 | Documentos | PDF institucional | Servicio | Alta | Guarda versión emitida | Formato/P-012 | 12 | CONFIRMADO_CON_PENDIENTE |
| RF-DOC-006 | Documentos | Verificación QR/código | Usuario externo | Media | No expone datos innecesarios | Aprobación/P-012/019 | 12 | CONFIRMADO_CON_PENDIENTE |
| RF-DOC-007 | Documentos | Cancelar sin borrar | Control escolar | Alta | Causa y reemplazo registrados | Auditoría | 12 | CONFIRMADO |
| RNF-001 | Operación | Disponibilidad | Institución | NO_DEFINIDA_EN_FUENTE | Objetivo 99.5 % mensual, sujeto a plan | P-017/020 | 16 | CONFIRMADO_CON_PENDIENTE |
| RNF-002 | Rendimiento | Respuesta de pantallas | Usuario | NO_DEFINIDA_EN_FUENTE | P95 <2.5 s bajo carga objetivo | P-017 | 16 | CONFIRMADO_CON_PENDIENTE |
| RNF-003 | Escalabilidad | Crecer sin rediseño total | Equipo técnico | NO_DEFINIDA_EN_FUENTE | Índices, paginación, storage desacoplado | P-017 | 1/16 | CONFIRMADO_CON_PENDIENTE |
| RNF-004 | Seguridad | RLS/MFA/HTTPS/secretos/auditoría | Todos | NO_DEFINIDA_EN_FUENTE | Pruebas indebidas fallan | F2–3 | 3/16 | CONFIRMADO |
| RNF-005 | Privacidad | Minimizar exposición | Todos | NO_DEFINIDA_EN_FUENTE | Solo campos necesarios | P-019 | 3/16 | CONFIRMADO_CON_PENDIENTE |
| RNF-006 | Usabilidad | Uso por no técnicos | Usuarios | NO_DEFINIDA_EN_FUENTE | Tasa de éxito por definir | UAT | 14/17 | CONFIRMADO_CON_PENDIENTE |
| RNF-007 | Accesibilidad | Teclado, etiquetas, contraste | Usuarios | NO_DEFINIDA_EN_FUENTE | Revisión antes de producción | Diseño UI | 4/16 | CONFIRMADO |
| RNF-008 | Compatibilidad | Navegadores modernos | Usuarios | NO_DEFINIDA_EN_FUENTE | Chrome/Edge; Safari/Firefox según prueba | Frontend | 16 | CONFIRMADO |
| RNF-009 | Trazabilidad | Auditar operaciones críticas | Auditores | NO_DEFINIDA_EN_FUENTE | 100 % de cambios definidos generan evento | Auditoría | 3/16 | CONFIRMADO |
| RNF-010 | Recuperación | Restauración ante incidente | Admin sistema | NO_DEFINIDA_EN_FUENTE | RPO/RTO aprobados y prueba documentada | P-018 | 16 | CONFIRMADO_CON_PENDIENTE |
| RNF-011 | Mantenibilidad | Modularidad, migraciones, documentación | Equipo técnico | NO_DEFINIDA_EN_FUENTE | Revisión y cobertura acordada | F1 | 1/16 | CONFIRMADO_CON_PENDIENTE |
| RNF-012 | Integridad | Sin huérfanos/duplicados | Sistema | NO_DEFINIDA_EN_FUENTE | FK, UNIQUE, CHECK y transacciones | Modelo definitivo | 6/16 | CONFIRMADO |
| RNF-013 | Exportación | PDF/XLSX/CSV | Administrativo | NO_DEFINIDA_EN_FUENTE | Formato según reporte | Reportes/P-012 | 15 | CONFIRMADO_CON_PENDIENTE |
| RNF-014 | Observabilidad | Errores y alertas operativas | Admin sistema | NO_DEFINIDA_EN_FUENTE | Panel y aviso de incidentes críticos | F1 | 1/16 | CONFIRMADO |

**Cobertura:** 68 requisitos funcionales y 14 no funcionales; total 82.

## Referencia precisa al Plan Maestro

| Identificadores | Referencia fuente |
|---|---|
| RF-AUT-001–007 | Sección 6.3, tabla de requisitos de autenticación |
| RF-ADM-001–009 | Sección 9.3, tabla de requisitos de admisión |
| RF-INS-001–007 | Sección 10.4, tabla de requisitos de inscripción |
| RF-ACA-001–007 | Sección 11.4, tabla de requisitos académicos |
| RF-HOR-001–007 | Sección 12.3, tabla de requisitos de horarios |
| RF-CAL-001–008 | Sección 13.4, tabla de requisitos de calificaciones |
| RF-ASI-001–008 | Sección 14.6, tabla de requisitos de asistencia |
| RF-PAG-001–008 | Sección 15.5, tabla de requisitos de pagos |
| RF-DOC-001–007 | Sección 16.4, tabla de requisitos de documentos |
| RNF-001–014 | Sección 22, tabla de requisitos no funcionales |
