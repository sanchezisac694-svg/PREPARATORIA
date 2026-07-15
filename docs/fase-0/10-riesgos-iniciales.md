# Riesgos iniciales

Escala cualitativa: probabilidad e impacto `Baja/Media/Alta`; nivel derivado `Bajo/Medio/Alto/Crítico`.

| ID | Riesgo | Prob. | Impacto | Nivel | Módulos | Mitigación | Responsable sugerido | Señal de alerta | Contingencia |
|---|---|---|---|---|---|---|---|---|---|
| R-001 | Reglas institucionales incompletas | Alta | Alta | Crítico | Todos | Cerrar P-001–P-020 antes del diseño definitivo | Product owner | Decisiones contradictorias | Congelar dominio afectado |
| R-002 | Alcance excesivo | Alta | Alta | Crítico | Todos | MoSCoW, fases y control de cambios | Patrocinador | Hitos desplazados | Reducir funciones no críticas |
| R-003 | RLS incorrecta expone menores | Media | Alta | Crítico | Identidad/portales | Matriz, revisión independiente y pruebas negativas | Líder técnico/privacidad | Acceso cruzado | Revocar acceso, contener y auditar |
| R-004 | Cuentas compartidas | Media | Alta | Alto | Seguridad/auditoría | Cuentas individuales y MFA | Dirección/admin | Sesiones anómalas | Bloqueo y rotación de acceso |
| R-005 | Archivos públicos por error | Media | Alta | Crítico | Expediente/documentos | Buckets privados y URLs firmadas | Líder técnico | URL anónima funcional | Cerrar bucket y revisar accesos |
| R-006 | Fallas de conectividad | Alta | Media | Alto | Asistencia/pagos | Procedimiento manual auditado | Operación | Caídas en horario escolar | Captura posterior reconciliada |
| R-007 | Capacitación insuficiente | Media | Alta | Alto | Portales/admin | Piloto, manuales y soporte | Product owner | Errores repetitivos | Extender piloto |
| R-008 | Identidades duplicadas | Media | Alta | Crítico | Identidad/admisión | Identidad única, restricciones y alta controlada | Control escolar | CURP/correo repetido | Flujo autorizado de conciliación |
| R-009 | Pagos mal conciliados | Media | Alta | Crítico | Pagos/inscripción | Separación de entidades y transacciones | Responsable financiero | Saldos inconsistentes | Suspender confirmación y conciliar |
| R-010 | Cambios de calificación sin control | Media | Alta | Crítico | Calificaciones | Cierres, autorización e historial | Control escolar | Cambio sin motivo | Revertir por flujo auditado |
| R-011 | Dependencia del proveedor | Media | Media | Medio | Plataforma | Exportaciones, migraciones y documentación | Líder técnico | Límites/costos crecientes | Plan de portabilidad |
| R-012 | Presupuesto insuficiente | Alta | Alta | Crítico | Todos | Definir costos y no recortar seguridad | Patrocinador | Plan sin recursos | Repriorizar alcance |
| R-013 | Sin responsable institucional | Alta | Alta | Crítico | Todos | Nombrar product owner | Dirección | Decisiones vencidas | Escalar al patrocinador |
| R-014 | Formatos oficiales indefinidos | Alta | Media | Alto | Documentos/reportes | Recabar y aprobar plantillas | Control escolar | Cambios frecuentes | Posponer emisión oficial |
| R-015 | Capacidad/concurrencia desconocida | Alta | Media | Alto | Rendimiento/costos | Resolver P-017 y pruebas de carga | Líder técnico | P95 supera objetivo | Ajustar índices/plan |
| R-016 | RPO/RTO sin aprobar | Alta | Alta | Crítico | Continuidad | Resolver P-018 y probar restauración | Admin/Institución | Copias no verificadas | Operación manual y restauración |
| R-017 | Privacidad sin definición | Alta | Alta | Crítico | Identidad/documentos | Resolver P-019 con responsable legal | Privacidad | Formularios sin consentimiento | Detener datos reales |
| R-018 | Estados/transiciones ambiguos | Media | Alta | Alto | Admisión/alumno/finanzas | Validar máquina de estados | Product owner | Registros imposibles | Bloquear transición y corregir |

## Referencia precisa al Plan Maestro

| Riesgos | Referencia fuente |
|---|---|
| R-001–R-014 | Sección 29, tabla de riesgos y mitigaciones |
| R-003, R-005, R-017 | Secciones 21.1–21.3 |
| R-006 | Sección 23.2 |
| R-008 | Secciones 1.3, 6.1 y 20.3 |
| R-009 | Secciones 15.2–15.5 |
| R-010 | Sección 13.4 |
| R-015 | Secciones 22 y 31, P-017 |
| R-016 | Secciones 23.1 y 31, P-018 |
| R-017 | Secciones 21.3 y 31, P-019 |
| R-018 | Secciones 9.2, 10.3 y 15.5 |
