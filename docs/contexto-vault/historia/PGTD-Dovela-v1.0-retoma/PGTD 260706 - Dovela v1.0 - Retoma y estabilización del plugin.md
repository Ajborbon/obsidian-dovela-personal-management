---
type: PGTD
estado: 🟢
fecha: 2026-07-06
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Sistema de Gestion Personal DOVELA|PGTD - Sistema de Gestion Personal DOVELA]]"
tags:
---

## Descripción

Retoma del desarrollo del plugin **Obsidian Dovela Personal Management** después de la pausa entre octubre de 2025 y julio de 2026. Este proyecto consolida el punto de partida para continuar el desarrollo: documenta el entorno real de trabajo, el estado del repositorio, los pendientes de consolidación de código y el backlog heredado de [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD - Dovela v0.9|PGTD - Dovela v0.9]].

La retoma se activó el 2026-07-06 al diagnosticar un crash de la bóveda ("Reiniciando bóveda" + `RangeError: Maximum call stack size exceeded`) causado por una recursión infinita en el módulo Backlinks del plugin, que fue corregida y verificada ese mismo día (ver [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin/RR - Sesiones de trabajo Dovela v1.0/Btx 260706 - Sesión 01 Dovela v10 - Fix recursión breadcrumbs y auditoría del en|Sesión 01]]).

## Entorno de desarrollo (referencia para retomar)

**Repositorio activo (código fuente + git), actualizado 2026-11-04:**
```
/Users/andresborbon/Proyectos/obsidian-dovela-personal-management/
```
Según la regla de ubicaciones (desarrollo en `~/Proyectos/`), esta es la copia de trabajo. Rama `main`, sin cambios sin commitear.

**Copia anterior en Google Drive (verificada el 2026-11-04, ya no es la de trabajo):**
```
/Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi unidad/Desarrollo Obsidian/Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management/
```
Ambas copias están en el mismo commit (`2887407`, v1.0.0) y su `src/` es idéntico. Conviene no editar en la de Drive para evitar divergencias.

**Vault de prueba (destino del hot-reload, configurado en `.env`; no verificado el 2026-11-04, la carpeta `~/GDrive-Crezco360/Desarrollo Obsidian` sí existe):**
```
/Users/andresborbon/GDrive-Crezco360/Desarrollo Obsidian/Desarrollo 2025/
```

**Flujo de trabajo:**
1. Editar código TypeScript en `src/` del repositorio activo
2. `pnpm dev` → compila y copia automáticamente al vault de prueba (hot-reload)
3. `pnpm build` → genera `main.js` de producción (~1.6MB minificado)
4. Copiar `main.js` manualmente a la bóveda real: `AJBB Crezco360/.obsidian/plugins/obsidian-dovela-personal-management/`

**GitHub:** `git@github.com:Ajborbon/obsidian-dovela-personal-management.git`

**Módulos del plugin:** moduloGTDv3, moduloFoco, moduloBacklinks, moduloActividad, moduloJournal, moduloWeekly

## Estado del repositorio — histórico

| Aspecto | Al 2026-07-06 (inicio) | Al 2026-07-06 (cierre sesión) |
|---|---|---|
| Rama estable | `main` (16 commits, sin push) | `main` (84 commits, en GitHub ✅) |
| Rama de desarrollo | `feat/journal-sistema-tareas-diarias` (65 commits adelante) | `feat/journal-sistema-tareas-diarias` (2 commits adelante de `main`) |
| Cambios sin commitear | fix recursión + tipos weekly | ninguno ✅ |
| Sin versionar | `Copia de styles.css`, `Documentacion/Agentes-Desarrollo/`, `.claude/` | `Copia de styles.css` en .gitignore; resto commiteado ✅ |
| Stash pendiente | 1 en `feature/smart-inbox` | descartado (obsoleto) ✅ |
| Versión en manifest.json | 0.0.0 | **1.0.0** ✅ |

✅ **Repositorio consolidado el 2026-07-06.** Todo el trabajo de ago–oct 2025 está en `main` y en GitHub.

## Historial

[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD 260706 - Dovela v1.0 - Retoma y estabilización del plugin/RR - Sesiones de trabajo Dovela v1.0/RR - Sesiones de trabajo Dovela v1.0|RR - Sesiones de trabajo Dovela v1.0]] — Bitácora de sesiones de trabajo de esta retoma.

## Recursos

- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela|RC - Desarrollo Dovela]] — Registro de commits con notas Cmt (al día hasta 2025-10-25).
- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD - Dovela v0.9|PGTD - Dovela v0.9]] — Proyecto anterior con el backlog heredado (40 tareas abiertas por auditar).
- [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.2/PGTD - Recreación del entorno base para desarrollo del plugin de Dovela/Ax 250702 - Como conseguir que el compilado del plugin se copie en la carpeta correcta para las pruebas automaticas usando pnpm dev|Ax 250702 - Compilado automático con pnpm dev]] — Guía del flujo de build y hot-reload.

## Tareas

- [x] Commitear en `feat/journal-sistema-tareas-diarias` el fix de recursión de `breadcrumbRenderer.ts` y el ajuste de tipos de `weeklyTaskRenderer.ts` #cx-vibeCoding ⏫ ➕ 2026-07-06 ✅ 2026-07-06
- [x] Registrar el Cmt del fix de breadcrumbs en [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RC - Desarrollo Dovela/RC - Desarrollo Dovela|RC - Desarrollo Dovela]] #cx-vibeCoding ➕ 2026-07-06 ✅ 2026-07-06
- [x] Consolidar ramas: merge de `feat/journal-sistema-tareas-diarias` a `main` y push a GitHub — fast-forward exitoso, 67 commits ya en main y GitHub #cx-vibeCoding ⏫ ➕ 2026-07-06 ✅ 2026-07-06
- [x] Decidir destino de los archivos sin versionar del repo: `Copia de styles.css` → .gitignore; `Documentacion/Agentes-Desarrollo/` y `.claude/` → commiteados a main #cx-vibeCoding ➕ 2026-07-06 ✅ 2026-07-06
- [x] Revisar el stash pendiente de `feature/smart-inbox` ("UI: Mejoras visuales en Time Tracker") — descartado, demasiado antiguo para aplicar sobre 60+ commits posteriores #cx-vibeCoding ➕ 2026-07-06 ✅ 2026-07-06
- [ ] Auditar las 40 tareas abiertas de [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Dovela v0.9/PGTD - Dovela v0.9|PGTD - Dovela v0.9]] con /obsidian-dovela-gtd-auditor y migrar a este proyecto las que sigan vigentes #cx-vibeCoding ➕ 2026-07-06
- [x] Definir esquema de versionado del plugin y actualizar `manifest.json` (ahora en 1.0.0) #cx-vibeCoding ➕ 2026-07-06 ✅ 2026-07-06

## Tareas del proyecto
```datacorejsx
return function View() {
    const current = dc.useCurrentFile();
    const folder = current?.$path?.includes("/")
        ? current.$path.substring(0, current.$path.lastIndexOf("/"))
        : "";

    const indexVersion = dc.useIndexUpdates();
    const [openTasks, setOpenTasks] = dc.useState(null);

    dc.useEffect(() => {
        let cancelled = false;

        async function loadTasks() {
            try {
                const vault = dc.app.vault;
                const meta = dc.app.metadataCache;
                const files = vault.getMarkdownFiles().filter(function(f) {
                    return f.path.startsWith(folder + "/");
                });

                const tasks = [];
                for (const file of files) {
                    const cache = meta.getFileCache(file);
                    if (!cache || !cache.listItems) continue;
                    const openItems = cache.listItems.filter(function(item) {
                        return item.task === " ";
                    });
                    if (!openItems.length) continue;

                    const content = await vault.cachedRead(file);
                    const lines = content.split("\n");

                    for (const item of openItems) {
                        const line = lines[item.position.start.line] || "";
                        const match = line.match(/^[\s\t]*-\s+\[\s\]\s+(.*)/);
                        if (match) {
                            tasks.push({
                                text: match[1].trim(),
                                filePath: file.path,
                                fileFolder: file.path.substring(0, file.path.lastIndexOf("/")),
                                fileName: file.basename,
                                lineNumber: item.position.start.line
                            });
                        }
                    }
                }

                if (!cancelled) setOpenTasks(tasks);
            } catch (err) {
                if (!cancelled) setOpenTasks([]);
            }
        }

        loadTasks();
        return function() { cancelled = true; };
    }, [folder, indexVersion]);

    function navigateToTask(filePath, lineNumber) {
        const file = dc.app.vault.getAbstractFileByPath(filePath);
        if (!file) return;
        const leaf = dc.app.workspace.getLeaf(false);
        leaf.openFile(file, {
            eState: { line: lineNumber, cursor: { from: { line: lineNumber, ch: 0 }, to: { line: lineNumber, ch: 0 } } }
        });
    }

    if (openTasks === null) {
        return h("div", { style: { color: "var(--text-muted)", fontSize: "0.9em" } }, "Cargando...");
    }

    if (!openTasks.length) {
        return h("div", { style: { borderLeft: "3px solid var(--color-orange)", paddingLeft: "10px", margin: "4px 0" } },
            h("strong", null, "⚠️ Sin tareas abiertas"),
            h("p", { style: { margin: "4px 0", fontSize: "0.9em", color: "var(--text-muted)" } },
                "Este proyecto GTD requiere revisión: definir si se cierra o necesita nuevas acciones."
            )
        );
    }

    const grouped = {};
    for (const t of openTasks) {
        const relDir = t.fileFolder === folder
            ? "(raíz del proyecto)"
            : t.fileFolder.replace(folder + "/", "");
        if (!grouped[relDir]) grouped[relDir] = {};
        if (!grouped[relDir][t.fileName]) grouped[relDir][t.fileName] = [];
        grouped[relDir][t.fileName].push(t);
    }

    const count = openTasks.length;

    return h("div", null,
        h("p", { style: { margin: "0 0 8px 0" } },
            h("strong", null,
                "☑ " + count + " tarea" + (count !== 1 ? "s" : "") + " abierta" + (count !== 1 ? "s" : "")
            )
        ),
        Object.entries(grouped).map(function(subdirEntry) {
            const subdir = subdirEntry[0];
            const files = subdirEntry[1];
            return h("div", { key: subdir, style: { marginBottom: "6px" } },
                h("div", { style: { fontWeight: "bold", marginBottom: "2px" } },
                    (subdir === "(raíz del proyecto)" ? "📂 " : "📁 ") + subdir
                ),
                Object.entries(files).map(function(fileEntry) {
                    const fn = fileEntry[0];
                    const tasks = fileEntry[1];
                    return h("div", { key: fn, style: { marginLeft: "12px", marginBottom: "3px" } },
                        h("div", { style: { fontSize: "0.85em", color: "var(--text-muted)" } },
                            "📄 " + fn + " (" + tasks.length + ")"
                        ),
                        tasks.map(function(t, i) {
                            return h("div", {
                                key: i,
                                title: "Ir a la tarea en " + t.fileName,
                                style: {
                                    marginLeft: "12px",
                                    fontSize: "0.9em",
                                    cursor: "pointer",
                                    color: "var(--link-color, var(--text-accent))"
                                },
                                onClick: function() { navigateToTask(t.filePath, t.lineNumber); }
                            }, "☐ " + t.text);
                        })
                    );
                })
            );
        })
    );
}
```

## Estructura PGTD

### Proyectos GTD y RR
```base
filters:
  and:
    - or:
        - type == "PGTD"
        - type == "RR"
    - file.inFolder(this.file.folder)
formulas:
  Carpeta: |
    if(
      file.folder == this.file.folder,
      this.file.folder.split("/")[this.file.folder.split("/").length - 1],
      file.folder
        .replace(
          this.file.folder.split("/").slice(0, -1).join("/") + "/",
          ""
        )
        .split("/")
        .slice(0, -1)
        .join("/")
    )
views:
  - type: table
    name: PGTD y RR de PGTD
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - estado
      - file.name
    sort:
      - property: estado
        direction: DESC
      - property: file.folder
        direction: ASC
      - property: file.mtime
        direction: DESC
    markers: number

```

### Contenido Completo
```base
filters:
  and:
    - file.ext == "md"
    - file.inFolder(this.file.folder)
formulas:
  Carpeta: |
    file.folder
      .replace(
        this.file.folder.split("/").slice(0, -1).join("/") + "/",
        ""
      )
views:
  - type: table
    name: Contenido
    groupBy:
      property: formula.Carpeta
      direction: ASC
    order:
      - type
      - estado
      - file.name
    sort:
      - property: estado
        direction: DESC
      - property: file.mtime
        direction: DESC

```

------
