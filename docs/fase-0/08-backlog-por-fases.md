# Backlog por fases

Las fases descomponen el Plan Maestro sin autorizar ejecución. Todas excluyen decisiones institucionales no aprobadas.

| Fase | Objetivo y alcance | Dependencias / entrada | Entregables | Exclusiones | Pruebas y salida | Riesgos / pendientes | Referencia al Plan Maestro |
|---|---|---|---|---|---|---|---|
| 0. Validación y documentación | Aprobar alcance, reglas, roles, estados, riesgos y trazabilidad | Plan Maestro leído | 12 documentos, actas, responsables | Código, datos, UI | Revisión por áreas; autorización expresa | Todos; P-001–P-020 | Secciones 26, 30–32 |
| 1. Fundamentos técnicos | Repositorios, entornos, CI/CD, observabilidad y estrategia de migración | F0 aprobada; equipo/presupuesto | Entornos separados y estándares | Módulos funcionales | Smoke de entornos y secretos; base operativa | P-017, P-018, P-020 | Secciones 24 y 26 |
| 2. Identidad y autenticación | Personas, perfiles, cuentas, sesión, recuperación y MFA | F1; identidad aprobada | Flujos Auth y ciclo de cuenta | Permisos de dominio | Unitarias/integración Auth; cuentas seguras | P-015, P-019 | Sección 6 |
| 3. Seguridad y RLS | Roles, vínculos, mínimo privilegio, auditoría base | F2; matriz aprobada | Matriz conceptual y pruebas negativas; sin políticas finales aún | UI de módulos | Todo acceso cruzado falla | P-011, P-015, P-016, P-019 | Secciones 6.3 y 21 |
| 4. Sitio público | Información, convocatoria, privacidad y accesos | F2/3; branding | Sitio responsivo y accesible | Portal autenticado completo | Accesibilidad, navegador y contenido | P-001, P-019 | Sección 8.1 |
| 5. Admisión | Solicitud, documentos, examen y decisión; núcleo financiero mínimo para cargo/voucher de ficha | F2/3/4; concepto, cargo, voucher, folio, monto, vigencia y consulta financiera | Proceso de admisión y ficha/voucher; no se declara cerrado el tramo que exige pago confirmado | Confirmación de transferencia/efectivo, aplicación y recibo; examen digital/lista automática | Estados, historial, cargo y voucher; salida financiera condicionada a F11/F16 | P-002–P-004, P-011 | Secciones 9 y 15.1/15.4 |
| 6. Núcleo académico | Ciclos, planes, materias, áreas, grupos, alumnos/tutores | F2/3; catálogos | Núcleo versionado y restricciones | Horario/optimización | Integridad, cupo y avance | P-005, P-006, P-014, P-016 | Sección 11 |
| 7. Horarios y cargas | Maestros, cargas, espacios y sesiones | F6 | Horarios sin conflicto | Sustituciones/optimizador | Conflictos y límites de jornada | Catálogos/funciones tutor | Sección 12 |
| 8. Asistencia y prefectura | Lista, retardos, justificantes, cancelaciones y alertas | F7, RLS | Operación docente/prefectura | Offline completo | Casos críticos de asistencia | P-007, P-008 | Sección 14 |
| 9. Calificaciones | Unidades, final, AC/NA, redondeo, cierre/publicación | F6/7, RLS | Captura e historial | Automatización no aprobada | 5-5-10, 5.95 y límites | P-009 | Sección 13 y Anexo C |
| 10. Inscripción y reinscripción | Conversión, matrícula, grupo, estados y recursamiento; núcleo financiero mínimo para cargo y consulta | F5/6/9; cargo asociado y capacidad de consultar pago confirmado | Proceso preparado y cargo emitido; confirmación final condicionada a F11/F16 | Registrar/confirmar pago, aplicar y emitir recibo | Conversión sin duplicado y bloqueos; no declarar inscripción pagada sin F11 | P-003, P-010, P-014, P-015 | Sección 10 y Sección 15.1 |
| 11. Operación financiera y confirmación de pagos | Efectivo, comprobante, revisión, pago, aplicación, recibo, cancelación, reembolso, auditoría y conciliación | F3 y núcleos mínimos creados en F5/F10 | Operación financiera completa y auditable | Pasarela/mensualidades | Atomicidad, rechazo, aplicación, recibo y conciliación | P-011–P-013 | Secciones 15.2–15.5 |
| 12. Documentos | Storage, solicitudes, folios, generación y cancelación | F3, F10/11 según documento | Documentos privados/versionados | Formato no aprobado/certificado | Privacidad, folio y reemisión | P-001, P-004, P-010, P-012, P-019 | Sección 16 |
| 13. Avisos y notificaciones | Audiencias, avisos internos y correo | F3 y dominios | Publicación segmentada y entrega | SMS/WhatsApp/chat libre | Aislamiento de audiencia | P-001, P-019 | Sección 17 |
| 14. Portales por rol | Integrar dashboards y tareas por rol | F5–13 aplicables | Portal Escolar y Administrativo | Nuevos permisos | E2E por rol y accesibilidad | P-015, P-016 | Secciones 8 y 18 |
| 15. Reportes | Consultas/exportaciones institucionales | Datos y permisos estables | PDF/XLSX/CSV iniciales | Formatos de autoridad no aprobados | Exactitud, alcance y volumen | P-002, P-005, P-012, P-017 | Sección 19 |
| 16. Integración y endurecimiento | Completar E2E de admisión/inscripción con pago confirmado; rendimiento, seguridad, recuperación y observabilidad | F1–15, especialmente F5/F10/F11 | Flujos financieros integrados y release candidata | Nuevas funciones | Admisión e inscripción alcanzan cierre solo aquí; carga, restauración, seguridad y regresión | P-017–P-020 | Secciones 25–28 |
| 17. UAT y piloto | Validación real, capacitación y salida controlada | F16; usuarios y casos firmados | Evidencias UAT, piloto y rollback | Despliegue masivo inmediato | Criterios de aceptación firmados | Todos los bloqueantes cerrados | Secciones 25, 26 y 28 |

## Criterios comunes

- **Entrada:** dependencias terminadas, pendientes límite resueltos, datos/configuración de prueba y criterios acordados.
- **Salida:** entregables revisados, pruebas funcionales/seguridad aplicables aprobadas, trazabilidad actualizada y ningún defecto crítico abierto.
- **Riesgo transversal:** iniciar una fase con una regla institucional pendiente convierte supuestos en deuda de arquitectura.
