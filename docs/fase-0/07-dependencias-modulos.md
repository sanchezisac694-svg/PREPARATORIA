# Dependencias entre módulos

## Mapa textual

```text
Validación institucional
  -> Fundamentos y entornos
  -> Identidad/Auth -> Roles/RLS/Auditoría
      -> Sitio público y autorregistro
      -> Núcleo financiero mínimo
          -> Admisión: cargo y voucher de ficha
          -> Inscripción: cargo y consulta de pago confirmado
      -> Operación financiera completa: comprobante/efectivo -> pago -> aplicación -> recibo
      -> Núcleo académico -> Horarios/Cargas
                              -> Asistencia/Prefectura
                              -> Calificaciones
      -> Expediente/Storage -> Documentos/Folios
      -> Avisos/Notificaciones
  -> Portales por rol y reportes
  -> Integración/endurecimiento -> UAT -> Piloto
```

## Ruta crítica

Validación → identidad y RLS → núcleo académico → horarios/cargas → asistencia y calificaciones → integración → UAT → piloto. En paralelo, identidad/RLS habilita un núcleo financiero mínimo; admisión e inscripción crean cargos y vouchers, mientras que la confirmación, aplicación y recibo se completan en Operación financiera y confirmación de pagos. Los flujos que exigen pago confirmado cierran funcionalmente durante integración.

## Trabajo posible en paralelo

- Tras validar arquitectura: entornos, diseño UX y estrategia de pruebas.
- Tras identidad/RLS: sitio público, admisión y núcleo académico.
- Tras cargas/horarios: asistencia y calificaciones.
- Tras definir audiencias: avisos; tras definir dominios: reportes.
- Documentos técnicos pueden preparar motor privado y auditoría, pero las plantillas oficiales esperan P-012 y formatos aprobados.

## Módulos que no deben comenzar sin identidad y RLS

Portales de alumno/tutor/maestro, expedientes, archivos, admisión autenticada, pagos, calificaciones, asistencia, justificantes, documentos, reportes personales y cualquier operación administrativa con datos reales.

## Admisión, inscripción y pagos

- El núcleo financiero mínimo precede o forma parte de las fases consumidoras e incluye conceptualmente concepto de cobro, cargo, voucher, folio único, monto, vigencia, estados sugeridos, consulta financiera y asociación con ficha/inscripción/reinscripción.
- El núcleo mínimo no confirma transferencias, no registra cobro completo, no aplica pagos y no emite recibos.
- Admisión necesita convocatoria, persona, cuenta verificada, expediente y cargo/voucher de ficha.
- La conversión exige ACEPTADO, requisitos vigentes y operación transaccional sin duplicar persona.
- Inscripción puede crear su cargo y consultar el estado; su confirmación final necesita pago confirmado, documentos validados y grupo manual con capacidad.
- La operación financiera completa registra efectivo o comprobante, revisa transferencia, confirma pago, lo aplica al cargo, emite recibo y conserva cancelación, reembolso, conciliación y auditoría.
- Cargo/voucher pertenecen al núcleo mínimo; comprobante, pago, aplicación y recibo pertenecen a la operación financiera completa.
- Reinscripción además depende de acreditación académica y firma/evidencia del tutor.

## Núcleo académico, horarios, asistencia y calificaciones

- El núcleo define ciclo, plan versionado, materia, área, grupo, alumno e inscripción.
- La carga une maestro, materia, grupo, espacio y periodo; sin carga no existe horario operativo.
- Las sesiones nacen del horario/carga; asistencia y alertas dependen de sesiones concretas.
- Las calificaciones dependen de alumno inscrito, carga, tres unidades y ventanas configuradas.
- Cierre, publicación y corrección dependen de autorización y auditoría.

## Documentos, folios y formatos

- Storage privado y metadatos de archivo preceden expediente y documentos.
- Folios únicos y servicio de generación preceden emisión.
- Recibo depende de pago confirmado; comprobante de inscripción depende del proceso confirmado; boleta depende de cierre/publicación.
- P-001, P-004, P-010, P-012, P-019 y formatos reales bloquean o limitan plantillas oficiales.

## Tabla resumen

| Módulo | Dependencia | Tipo | Fase requerida | Consecuencia si falta | Referencia al Plan Maestro |
|---|---|---|---|---|---|
| Identidad/Auth | Fundamentos y decisiones de identidad | Técnica/funcional | 1–2 | No existen cuentas ni persona única | Secciones 5, 6 y 20 |
| RLS/seguridad | Identidad, roles y vínculos | Seguridad | 2–3 | No deben abrirse módulos con datos personales | Secciones 6.3 y 21 |
| Núcleo financiero mínimo | Identidad, folios y conceptos aprobados | Funcional compartida | Antes o dentro de 5 y 10 | No se generan cargos/vouchers ni se consulta condición | Secciones 9.1, 10.1 y 15.1–15.5 |
| Admisión | Identidad/RLS y núcleo financiero mínimo | Funcional | 2–3 y 5 | No hay solicitud segura ni ficha/voucher | Sección 9 |
| Núcleo académico | Identidad/RLS y catálogos | Funcional | 2–3 y 6 | No hay grupos, planes ni inscripciones académicas | Sección 11 |
| Horarios/cargas | Núcleo académico | Funcional | 6–7 | No hay sesiones válidas | Sección 12 |
| Asistencia | Horarios, cargas y RLS | Funcional/seguridad | 7–8 | No hay lista por sesión | Sección 14 |
| Calificaciones | Núcleo académico, cargas y RLS | Funcional/seguridad | 6–9 | No hay captura autorizada ni AC/NA | Sección 13 |
| Inscripción | Admisión, núcleo académico y núcleo financiero mínimo | Funcional | 5–6 y 10 | Puede prepararse, pero no confirmarse sin pago | Sección 10 |
| Operación financiera completa | Núcleo financiero mínimo, roles y RLS | Transaccional/seguridad | 11 | No se confirma/aplica pago ni se emite recibo | Secciones 15.2–15.5 y 21.1 |
| Integración de admisión/inscripción | Operación financiera completa | Integración | 16 | Los flujos dependientes de pago no alcanzan cierre E2E | Secciones 25–28 |
| Documentos/folios | Formatos oficiales, storage y eventos origen | Funcional | 12 | No se emiten documentos oficiales válidos | Sección 16 y Sección 31, P-012 |
