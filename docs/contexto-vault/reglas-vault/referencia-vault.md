# Referencia detallada del Vault AJBB

> Documento de consulta. No se carga en contexto automáticamente.
> `CLAUDE.md` lo referencia; léelo cuando necesites el detalle de tipos, RR o jerarquía.

---

## Tabla completa de tipos de nota (YAML `type:`)

| Tipo      | Descripción                                                                                          | Frecuencia aprox. |
| --------- | ---------------------------------------------------------------------------------------------------- | ----------------- |
| `Ax`      | Anotación general — notas de conferencias, ideas, investigaciones, documentos                         | ~1.379            |
| `PGTD`    | Proyecto GTD — contenedor de un proyecto o evento con sus tareas e hijos                              | ~310              |
| `Tx`      | Transacción financiera — soporte de pago, transferencia, cobro                                        | ~189              |
| `Dly`     | Diario diario — nota de planeación y reflexión del día                                                | ~176              |
| `AI`      | Área de Interés — subcategoría dentro de un AV                                                        | ~160              |
| `Reu`     | Reunión — notas de sesiones, kickoffs, acompañamientos                                                | ~129              |
| `Cmt`     | Commit — registro de commit de código en proyectos de desarrollo                                      | ~105              |
| `RR`      | Recurso Recurrente — carpeta-contenedor que agrupa instancias repetidas del mismo tipo de documento   | ~74               |
| `Vx`      | Video/Recurso visual — fichas de videos, reels, herramientas                                          | ~29               |
| `AV`      | Área de Vida — nivel intermedio de organización                                                       | ~26               |
| `Wly`     | Semana — nota de revisión y planeación semanal                                                        | ~15               |
| `GrupoAV` | Grupo de Áreas de Vida — nota índice de un grupo                                                      | ~7                |
| `Ref`     | Reflexión — notas de voz con pensamientos, luego procesadas                                           | ~6                |

---

## Jerarquía completa

```
Grupo (ej: 01 - Productividad)
└── AV - Área de Vida (ej: AV - Negocios)
    └── AI - Área de Interés (ej: AI - Crezco360)
        └── PGTD - Proyecto/GTD (ej: PGTD 260210 - Capacitación Ventas)
            ├── Ax YYMMDD - Anotación.md
            ├── Reu YYMMDD - Reunión.md
            ├── Tx YYMMDD - Transacción.md
            └── 99 - Adjuntos/
```

### Grupos principales (nivel raíz)

```
00 - Inbox                  → Captura sin clasificar (punto de entrada)
01 - Productividad          → Negocios, eventos, proyectos personales
02 - Desarrollo Habilidades → Aprendizaje activo (marketing, programación, música, IA, audiovisual)
03 - Gestion Personal       → Vida diaria, journals, compras, conocimiento
04 - Finanzas Personales    → Activos, pasivos, planeación financiera
05 - Balance Interior       → Salud física, emocional, espiritual, sexual, arquitectura del ser
06 - Relaciones             → Familia, amigos, pareja
07 - Entretenimiento        → Planes, viajes
```

---

## Recursos Recurrentes (RR) — patrón carpeta-contenedor

Un **RR no es una nota suelta**: es una **carpeta** que agrupa instancias repetidas del mismo tipo de documento o actividad. Dentro vive una **nota índice** con el mismo nombre (tipo `RR`), y a su lado se acumulan los hijos.

```
RR - Nombre del Recurso/          ← carpeta contenedora
├── RR - Nombre del Recurso.md    ← nota índice (type: RR)
├── Tx YYMMDD - Instancia 1.md    ← hijos del mismo tipo
├── Tx YYMMDD - Instancia 2.md
└── 99 - Adjuntos/                ← adjuntos opcionales
```

**Cuándo crear un RR:** cuando un mismo evento o documento se repite periódicamente y no tiene fin definido.

Ejemplos reales del vault:
- `RR - Pagos Arriendo Local Experto Center…` → acumula `Tx` de pagos mensuales
- `RR - Sesiones de trabajo del proyecto` → acumula `Reu` de sesiones recurrentes
- `RR - Videos sobre recursos y herramientas digitales` → acumula `Vx` del mismo tema
- `RR - Planillas Laborales` → acumula `Tx` de nómina mensual
- `RR - Contenido Youtube Semanal` → acumula notas de revisión semanal

**Diferencias clave:**
- vs `PGTD`: un proyecto tiene objetivo y cierre; un RR no tiene fin — es colector permanente.
- vs `AI`/`AV`: un área agrupa proyectos y subtemas variados; un RR agrupa **instancias del mismo tipo de cosa** bajo un contexto concreto.

**La nota índice** suele contener descripción, un Dataview que lista los hijos, y eventualmente historial o saldo acumulado.

---

## Wikilinks

- Ruta completa cuando enlazas desde contextos distintos:
  `[[01 - Productividad/AV - Eventos/AI - Cámara de Comercio/AI - Cámara de Comercio|AI - Cámara de Comercio]]`
- Nombre simple cuando el contexto es claro:
  `[[Ax 250827 - Tu logo no es tu marca]]`
- El campo `origen::` (Dataview inline) apunta al contenedor padre.

## Secciones comunes en notas AV / AI / PGTD

- `## Descripción` — propósito del área o proyecto
- `## Historial` — hijos y anotaciones vinculadas
- `## Recursos` — links y adjuntos
- `## Tareas` — tasks de Obsidian Tasks plugin (`- [ ]`)

---

## Contexto de negocios y proyectos

### Proyectos personales
- **Crezco360** — negocio principal (este vault)
- **Washflow** — proyecto de software propio (con commits registrados)
- **Profit Pulse** — proyecto en desarrollo

### Clientes y negocios (AV - Negocios)
Área Andina, Experto Center, Imanku, Negocios IMK, Negocios con Daniela,
Reynaldo Villareal, CCB (Cámara de Comercio de Bogotá)

### Eventos registrados
Go Fest 2025 (Cámara de Comercio), TechWeek 2025 Colombia, WakeUp Conference Bogotá,
Primer Encuentro C-MA Empresarial (sep 2025), Capacitación Ventas Organización MAS (feb 2026),
KickOff iWhale - ETB (feb 2026)
