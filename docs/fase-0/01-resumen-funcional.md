# Resumen funcional de la V1

**Fuente:** `docs/Plan_Maestro_Sistema_Preparatoria_V1.docx`, versión 1.0.  
**Estado:** documentación de preparación; su contenido no constituye esquema físico ni autorización para desarrollar.

## Propósito

Construir un sistema web institucional para una preparatoria pública, de un plantel y turno matutino, que acompañe a una persona desde aspirante hasta egreso y centralice admisión, control escolar, operación académica, asistencia, pagos, documentos, comunicación, reportes y auditoría. Cada rol verá solamente la información y acciones necesarias para su función.

## Alcance de V1

- Una identidad y expediente únicos por persona, con roles múltiples e historial.
- Seis semestres secuenciales, materias fijas y cuatro áreas desde quinto semestre.
- Operación web responsiva para usuarios externos e internos.
- Configuración por ciclo, periodo, convocatoria, grupo, materia, cargo y ventana de captura.
- Seguridad por autenticación, MFA administrativo, RLS, archivos privados, servicios seguros y auditoría.
- Un núcleo de datos compartido por dos aplicaciones.

## Funciones incluidas

| Dominio | Funciones V1 |
|---|---|
| Sitio y acceso | Sitio institucional, registro de aspirante, inicio de sesión, verificación y recuperación. |
| Identidad | Personas, perfiles, roles múltiples, vínculo tutor-alumno y bloqueo sin borrar historial. |
| Admisión | Convocatoria, solicitud, expediente, ficha, examen físico, resultado, decisión y publicación. |
| Control escolar | Alumnos, maestros, ciclos, planes, materias, áreas, grupos, inscripciones y estados. |
| Horarios | Cargas, espacios, horario institucional, tutor y asesor por grupo. |
| Evaluación | Tres unidades, final manual, AC/NA, redondeo, cierre, publicación y correcciones auditadas. |
| Asistencia | Lista por sesión, retardos, faltas, justificantes, cancelaciones y alertas entre clases. |
| Finanzas | Cargos de $300 MXN confirmados, vouchers, efectivo, transferencia, comprobantes y recibos. |
| Documentos | Expediente privado, solicitudes, generación, folios, cancelación y versiones emitidas. |
| Comunicación | Avisos segmentados, notificaciones internas y correo cuando aplique. |
| Reportes | Consultas y exportaciones académicas, administrativas, financieras y de auditoría. |
| Operación | Entornos separados, pruebas, monitoreo, respaldo, recuperación y despliegue. |

## Fuera de alcance

- Examen digital, banco de reactivos, lista de espera y reasignación automática.
- Multi-plantel, mensualidades, pasarela de pago y aplicación móvil nativa.
- Sustituciones docentes, optativas, mezcla o adelanto de semestres, cursos especiales.
- LMS completo, evaluación docente, nómina, biometría y control físico de acceso.
- Integraciones oficiales sin formatos aprobados, firma electrónica avanzada y chat libre completo.
- Operación offline completa, certificado oficial o credencial digital sin aprobación expresa.

## Aplicaciones principales

1. **Portal Escolar:** aspirantes, alumnos, tutores y maestros; acceso por internet y navegación por rol.
2. **Sistema Administrativo:** dirección, subdirección, control escolar y prefectura; MFA, sesiones reforzadas y mayor auditoría.

Ambas aplicaciones usan el mismo núcleo. Las lecturas simples pueden ir desde el cliente con RLS; conversiones, pagos, folios, documentos, altas privilegiadas y correcciones cerradas requieren servicio seguro.

## Usuarios principales

ASPIRANTE, ALUMNO, TUTOR, MAESTRO, PREFECTO, CONTROL_ESCOLAR, DIRECTOR, SUBDIRECTOR y ADMIN_SISTEMA.

## Principios rectores

- Identidad única y fuente única de datos.
- Separación de responsabilidades y mínimo privilegio.
- Historial inalterable y operaciones críticas auditables.
- Seguridad y privacidad desde el diseño.
- Configuración institucional en datos, no reglas rígidas.
- Evolución controlada sin implementar funciones no validadas.
- Operaciones críticas transaccionales en servicios seguros.

## Dependencias institucionales

La V1 depende de resolver P-001 a P-020, aprobar reglas académicas, estados y permisos, entregar formatos reales, designar responsables, definir matrícula/concurrencia, privacidad, respaldo, presupuesto, equipo y fecha de piloto. No debe iniciarse la construcción masiva de datos o interfaces antes de cerrar identidad, reglas académicas, estados, permisos, pagos y documentos prioritarios.
