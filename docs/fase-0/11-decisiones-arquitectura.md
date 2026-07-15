# Decisiones de arquitectura confirmadas

No se definen nombres finales de tablas, columnas, índices o políticas. Cada registro tiene estado **ACEPTADA** porque aparece confirmado en el Plan Maestro.

| ID | Decisión | Contexto y motivo | Consecuencias | Riesgos | Estado | Referencia al Plan Maestro |
|---|---|---|---|---|---|---|
| ADR-001 | Supabase como plataforma principal | Unificar datos, identidad, archivos y controles gestionados | Dependencia de proveedor y plan contratado | Costos/límites/portabilidad | ACEPTADA | Resumen ejecutivo y Secciones 2.1, 5.2 |
| ADR-002 | PostgreSQL como base relacional | Los dominios requieren integridad, relaciones y transacciones | Uso futuro de restricciones, índices y migraciones tras diseño; sin nombres finales | Esquema prematuro si faltan reglas | ACEPTADA | Resumen ejecutivo, Secciones 5.2 y 22 |
| ADR-003 | Supabase Auth | Centralizar autenticación, recuperación y sesiones | Identidad de aplicación enlazada a cuenta de autenticación | Resolución matrícula/correo y ciclo de vida | ACEPTADA | Resumen ejecutivo y Sección 6 |
| ADR-004 | Storage privado | Proteger expedientes y comprobantes | Rutas/metadatos, sesión o URL firmada temporal | Exposición por configuración | ACEPTADA | Secciones 16.4 y 21.1 |
| ADR-005 | RLS obligatoria | La interfaz no es frontera de seguridad | Políticas conceptuales por usuario, rol, vínculo y carga; sin definir políticas finales | Una política incorrecta expone datos | ACEPTADA | Secciones 6.3 y 21.1–21.2 |
| ADR-006 | Dos aplicaciones, un núcleo | Separar Portal Escolar y Sistema Administrativo sin duplicar datos | Fronteras de interfaz y seguridad distintas; reglas compartidas | Divergencia si se duplican servicios | ACEPTADA | Resumen ejecutivo y Secciones 5.1–5.2 |
| ADR-007 | Identidad única | Evitar duplicar aspirante al convertirlo en alumno | Persona central, roles/perfiles coexistentes e historial | Conciliación de duplicados heredados | ACEPTADA | Secciones 1.3, 6.1 y 9.3 |
| ADR-008 | Servicios seguros para operaciones críticas | Conversión, pagos, folios y correcciones necesitan transacción y privilegio | API/función de servidor; secretos fuera del cliente | Mayor complejidad operativa | ACEPTADA | Secciones 5.3 y 21.1 |
| ADR-009 | Entornos separados | Aislar desarrollo, pruebas y producción | Configuración y secretos separados | Deriva de configuración | ACEPTADA | Secciones 21.1 y 24.1 |
| ADR-010 | Auditoría transversal | Cambios académicos, financieros y de identidad deben rastrearse | Eventos con usuario, fecha, antes/después y motivo | Volumen y acceso sensible | ACEPTADA | Secciones 21.4 y 22, RNF-009 |
| ADR-011 | Migraciones versionadas | Permitir evolución y portabilidad controladas | Todo cambio futuro será reproducible y revisable | Migraciones antes de validar reglas | ACEPTADA | Secciones 22, RNF-011 y 29 |
| ADR-012 | Datos ficticios en desarrollo | Evitar exposición de datos reales fuera de producción | Fixtures y pruebas sin información personal | Cobertura insuficiente si no son representativos | ACEPTADA | Sección 24.1 |
