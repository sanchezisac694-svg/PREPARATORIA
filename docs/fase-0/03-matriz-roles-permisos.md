# Matriz de roles y permisos

**Leyenda:** `SÍ` confirmado; `NO` restringido; `PV` = `PENDIENTE_VALIDACION`; `N/A` no corresponde. `Directo` significa lectura o captura ordinaria protegida por RLS; `Servicio` significa operación crítica en servidor. La matriz no amplía permisos del Plan Maestro.

| Rol | Módulo | Consultar | Crear | Modificar | Aprobar | Cancelar | Publicar | Exportar | Restricciones | Canal |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| ASPIRANTE | Admisión/expediente | SÍ | SÍ | SÍ | NO | PV | NO | NO | Solo su proceso; resultado solo publicado | Directo/RLS |
| ASPIRANTE | Pagos | SÍ | Voucher/comprobante | Sustituir comprobante rechazado | NO | NO | NO | Recibo propio | No confirma pagos | Directo + Servicio |
| ALUMNO | Académico/asistencia | Propio | Solicitudes | Corrección solicitada | NO | NO | NO | Documentos propios | Sin cambios académicos | Directo/RLS |
| ALUMNO | Inscripción/pagos/documentos | Propio | Voucher/solicitud | PV | NO | NO | NO | Propios | Acceso en bajas: PV P-015 | Directo + Servicio |
| TUTOR | Alumno vinculado | SÍ | Solicitudes/voucher | PV | Firma/aceptación: PV | NO | NO | Documentos autorizados | Solo vínculo vigente; P-010 | Directo + Servicio |
| MAESTRO | Cargas/horario/listas | Solo cargas propias | Asistencia/calificaciones | Durante ventana | NO | Cancelar sesión con causa | NO | PV | Sin pagos, expediente completo u otros grupos | Directo/RLS |
| MAESTRO | Admisión | Resultado asignado | Resultado final | Dentro de autorización | NO | NO | NO | NO | No decide aceptación | Directo/RLS |
| PREFECTO | Asistencia/horarios/alertas | Pertinente | Resolución/incidencia | SÍ | Justificantes | NO | NO | PV | Sin calificaciones ni pagos | Directo/RLS |
| CONTROL_ESCOLAR | Admisión | SÍ | Convocatoria/proceso | SÍ | Aceptar/rechazar | Cancelar con causa | Resultado | SÍ | Sin secretos ni infraestructura | Directo + Servicio |
| CONTROL_ESCOLAR | Núcleo académico | SÍ | Catálogos/grupos/cargas | SÍ | Inscripción/corrección según flujo | Estados con causa | Calificaciones | SÍ | Historial obligatorio | Directo + Servicio |
| CONTROL_ESCOLAR | Documentos | SÍ | Solicitud/emisión | SÍ | SÍ | SÍ, sin borrar | SÍ | SÍ | Formatos oficiales pendientes | Servicio |
| CONTROL_ESCOLAR | Pagos | SÍ | PV | PV | PV P-011 | PV | NO | SÍ | Rol financiero exacto pendiente | Servicio |
| DIRECTOR | Institucional | Todo lo funcional | PV | PV | Autorizaciones institucionales | PV | PV | SÍ | No usa credenciales técnicas | Directo + Servicio |
| SUBDIRECTOR | Institucional | Igual a director | PV | PV | Igual a director en V1 | PV | PV | SÍ | Rol separado aunque permisos iguales | Directo + Servicio |
| ADMIN_SISTEMA | Cuentas/seguridad | SÍ | Cuentas/roles | SÍ | Acceso técnico | Bloquear/revocar | NO | Auditoría técnica | Sin acceso académico por defecto | Servicio privilegiado |
| ADMIN_SISTEMA | Respaldo/monitoreo | SÍ | Configuración técnica | SÍ | Restauración supervisada | N/A | N/A | SÍ | No altera registros académicos sin flujo | Servicio privilegiado |

## Reglas transversales

- Ningún permiso de interfaz sustituye RLS o autorización de servidor.
- Las cuentas son individuales; los cambios de rol conservan vigencia, motivo y responsable.
- DIRECTOR y SUBDIRECTOR comparten permisos funcionales V1, pero no identidad ni auditoría.
- ADMIN_SISTEMA no hereda permisos académicos o financieros.
- Exportación contiene solo el alcance consultable del rol.
- Todo permiso no confirmado se mantiene como `PENDIENTE_VALIDACION`.

## Referencia precisa al Plan Maestro

| Filas o dominio de la matriz | Referencia fuente |
|---|---|
| Responsabilidad general por rol | Sección 4, tabla de usuarios, actores y responsabilidades |
| Consulta, acciones y restricciones por rol | Sección 4.1, matriz resumida de permisos |
| ASPIRANTE | Secciones 9 y 18.1 |
| ALUMNO | Secciones 8.2 y 18.2 |
| TUTOR | Secciones 6.3 y 18.3 |
| MAESTRO | Secciones 8.3, 13.4, 14.1 y 18.4 |
| PREFECTO | Secciones 14.5–14.6 y 18.5 |
| CONTROL_ESCOLAR | Secciones 9–16 y 18.6 |
| DIRECTOR/SUBDIRECTOR | Secciones 4.1 y 6.3 |
| ADMIN_SISTEMA | Secciones 4, 21.1 y 23.1 |
| Operación directa o servicio seguro | Sección 5.3 |
| Permisos pendientes | Sección 31, P-011/P-015/P-016/P-019 |
