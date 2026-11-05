<%*
moment.locale('es');

const nombreNota = tp.file.title; // Ej.: "2025-08-12 martes" o "2025-08-12"
const tipo = "Dly";

// Extraer fecha en formato YYYY-MM-DD desde el título (aunque tenga texto adicional)
const m = nombreNota.match(/\d{4}-\d{2}-\d{2}/);
if (!m) {
  tR += "No se encontró una fecha en el nombre de la nota (YYYY-MM-DD).";
  return;
}
const fecha = moment(m[0], "YYYY-MM-DD");

// IDs calculados
const isoYear = fecha.isoWeekYear();                       // Año ISO (para semanas en bordes de año)
const isoWeek = fecha.isoWeek();                           // Semana ISO (01..53)
const semanaId = `${isoYear}-W${String(isoWeek).padStart(2,'0')}`; // p.ej. "2025-W33"

const mesId = fecha.format('YYYY-MM');                     // p.ej. "2025-08"

const qNum = Math.ceil((fecha.month() + 1) / 3);           // 1..4 según mes de la fecha
const trimestreId = `${fecha.year()}-Q${qNum}`;            // p.ej. "2025-Q3"
-%>
---
type: <% tipo %>
semana: "[[<% semanaId %>]]"
mes: "[[<% mesId %>]]"
trimestre: "[[<% trimestreId %>]]"
estado: 🟢
tags:
destacado:
---
<%*
const anteriorFecha = moment(fecha).subtract(1, 'days');
const siguienteFecha = moment(fecha).add(1, 'days');

const anteriorTexto = anteriorFecha.format("YYYY-MM-DD dddd");
const siguienteTexto = siguienteFecha.format("YYYY-MM-DD dddd");
const hoyTexto = fecha.format("YYYY-MM-DD dddd");

const anteriorRuta = `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/${anteriorFecha.format("YYYY/MM")}/${anteriorTexto}`;
const siguienteRuta = `03 - Gestion Personal/AV - Gerente de Vida/AI - Journals/${siguienteFecha.format("YYYY/MM")}/${siguienteTexto}`;
const hoyRuta = tp.file.path().replace(".md", "");
-%>

[[<% anteriorRuta %>|⬅️ <% anteriorTexto %>]] | **📅 <% hoyTexto %>** | [[<% siguienteRuta %>|<% siguienteTexto %> ➡️]]
# Planeación del día
## Plan sugerido en revisión semanal
<%*
const weekLinkForEmbed = moment(fecha, "YYYY-MM-DD").format("YYYY-[W]WW");
-%>

<%* if (weekLinkForEmbed && fecha) { -%>
![[<% weekLinkForEmbed %>#<% moment(fecha).format("YYYY-MM-DD dddd") %> Plan y registro actividades Bloques definidos para el <% moment(fecha).format("YYYY-MM-DD dddd") %>]]
<%* } else { -%>
*Error: No se pudo determinar el enlace semanal o la fecha para incrustar el plan.*
<%* } -%>

## Planeación del día por bloques

# Pensamientos y sueños del día

```base
filters:
  and:
    - or:
        - type == "Ref"
        - type == "Sue"

views:
  - type: list
    name: Reflexiones del día
    filters:
      and:
        - fecha == this.fecha
    groupBy:
      property: file.folder
      direction: ASC
    order:
      - file.name
    markers: number

```

# Bitácora del día
## Borrador

# Tareas

```datacorejsx
return function View() {
    const current = dc.useCurrentFile();
    const [tasksNode, setTasksNode] = dc.useState(null);
    const [taskError, setTaskError] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadTasks() {
            try {
                const gp = dc.app?.plugins?.plugins?.["obsidian-dovela-personal-management"];

                if (!gp || !gp.journalAPI) {
                    if (!cancelled) setTaskError("Plugin no disponible");
                    return;
                }

                const fileName = current?.$name ?? "";
                const targetDate = fileName.split(" ")[0];

                const node = await gp.journalAPI.renderTasksForDate(targetDate);

                if (!cancelled) {
                    setTasksNode(node);
                    setTaskError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setTaskError(err?.message || String(err));
                }
            }
        }

        loadTasks();

        return () => {
            cancelled = true;
        };
    }, [current?.$path]);

    const allPages = dc.useQuery("@page");

    const backlinks = dc.useMemo(() => {
        if (!current?.$path) return [];

        return allPages
            .filter(p => p.$path !== current.$path)
            .filter(p => {
                const file = dc.app.vault.getAbstractFileByPath(p.$path);
                if (!file) return false;

                const cache = dc.app.metadataCache.getFileCache(file);
                const links = cache?.links ?? [];
                return links.some(link => {
                    const resolved = dc.resolvePath(link.link, p.$path);
                    return resolved === current.$path;
                });
            })
            .sort((a, b) => {
                const aTime = a.$ctime?.toMillis?.() ?? 0;
                const bTime = b.$ctime?.toMillis?.() ?? 0;
                return bTime - aTime;
            });
    }, [allPages, current?.$path]);

    const rows = backlinks.map(p => ({
        file: p.$link,
        tipo: p.value?.("type") ?? "",
        estado: p.value?.("estado") ?? "",
        ruta: p.$path
    }));

    return (
        <dc.Stack>
            <h2>Tareas del día</h2>

            {taskError ? (
                <p>Error: {taskError}</p>
            ) : tasksNode ? (
                <div ref={el => {
                    if (el && tasksNode && !el.hasChildNodes()) {
                        el.appendChild(tasksNode);
                    }
                }} />
            ) : (
                <p>Cargando tareas...</p>
            )}

            <h2>Notas apuntando a hoy</h2>

            <dc.Table
                rows={rows}
                columns={[
                    {
                        id: "file",
                        title: "File",
                        value: row => row.file
                    },
                    {
                        id: "tipo",
                        title: "Tipo",
                        value: row => row.tipo
                    },
                    {
                        id: "estado",
                        title: "Estado",
                        value: row => row.estado
                    },
                    {
                        id: "ruta",
                        title: "Ruta",
                        value: row => row.ruta
                    }
                ]}
            />
        </dc.Stack>
    );
}
```

# Reporte diario del Vault

```base
filters:
  and:
    - subtipo == "reporte-diario"
    - fecha == this.fecha
    - file.inFolder("03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RR - Reportes Diarios del Vault")

views:
  - type: table
    name: Reporte diario del Vault
    order:
      - file.name
      - notas_creadas
      - notas_modificadas
      - tareas_completadas
      - tareas_vencidas
      - tareas_cx_pendientes
      - total_tareas_abiertas
      - inbox_total
      - total_notas
      - backup_ok
    sort:
      - property: fecha
        direction: DESC
    markers: number

```

# Notas creadas hoy
```base
filters:
  and:
    - type != "Ref"
views:
  - type: list
    name: Notas creadas hoy
    filters:
      and:
        - fecha == this.fecha
    order:
      - file.name
      - file.ctime
    sort:
      - property: file.ctime
        direction: ASC
    markers: number

```

# Notas modificadas hoy
```base
filters:
  and:
    - type != "Ref"
views:
  - type: list
    name: Notas modificadas hoy
    filters:
      and:
        - file.mtime == this.fecha
    order:
      - estado
      - file.name
      - file.mtime
    sort:
      - property: file.mtime
        direction: ASC
    markers: bullet

```

