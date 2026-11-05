---
type: PGTD
estado: 🔵
tags:
origen: "[[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Sistema de Gestion Personal DOVELA|PGTD - Sistema de Gestion Personal DOVELA]]"
---

[ChatGPT](https://chatgpt.com/share/6848fc1e-b364-8012-b866-171887f5fa22)

## Descripción
Creación de una carpeta desde cero sincronizada con GDrive para poder usar 
## Historial

### Bitácora de Arranque – Dovela Personal Management

Este documento resume **todo lo que se hizo** para pasar de la idea a un repositorio listo para desarrollar y publicar el plugin de Obsidian.

### 0 · Requisitos instalados

| Herramienta | Versión instalada | Nota |
|-------------|------------------|------|
| Node.js     | 20 LTS           | Recomendado para plugins actuales. |
| pnpm        | 9 .x             | Gestor de paquetes rápido. |
| Git         | ≥ 2.40           | Control de versiones. |
| Claves SSH  | `~/.ssh/id_ed25519` | Subida a GitHub para push vía SSH. |
	
### 1 · Preparación de la carpeta del plugin

```bash
# (Estando en la bóveda de desarrollo)
mkdir -p ".../Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management"
cd ".../Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management"
````

1. Se ejecutó **yo obsidian-plugin** (con --skip-install para controlar deps).

2. Se añadieron y editaron archivos clave:
    
    - LICENSE (GPL‑3.0‑o‑posterior)        
    - COMMERCIAL-LICENSE_ES.TXT y COMMERCIAL-LICENSE_EN.TXT
    - README.md (con tabla CE vs Pro, instalación, patrocinio)
    - .gitignore (Node + extras de Obsidian)
    Hace falta:
    - .github/FUNDING.yml (GitHub Sponsors, BMC, Ko‑fi)
    - CONTRIBUTING.md (flujo de PR + CLA)
        
### 2 · Creación del repositorio en GitHub

1. En https://github.com/new se creó **obsidian-dovela-personal-management**
    
    - _Public_
    - Sin README, gitignore ni licencia (ya existen localmente).
        

### 3 · Inicialización local y primer push

```
# Asegúrate de estar en la raíz
git init                             # crea repo local
git add .                            # incluye todos los archivos
git commit -m "chore: initial scaffold, licences & README"

# conecta el remoto
git remote add origin git@github.com:ajborbon/obsidian-dovela-personal-management.git
git branch -M main                   # asegura rama main
git push -u origin main              # primer push
```

✔️  Se subieron **37 archivos** (código base + docs + config).

✔️  GitHub confirma la rama main y fija el rastreo origin/main.

### 4 · Instalación de dependencias y enlace con la bóveda

```
pnpm install                      # descargas iniciales (node_modules/)
pnpm dev -- --vault "/ruta/a/la/bóveda"   # watch + copia en vivo
```

- Al guardar cambios en src/**, esbuild recompila y actualiza el plugin dentro de la bóveda.

- En Obsidian: _Settings → Community Plugins → Enable_ → “Dovela Personal Management”.
    
### 5 · Estado actual del proyecto

| **Elemento**                  | **Estado**                                                                |
| ----------------------------- | ------------------------------------------------------------------------- |
| Estructura de carpetas        | Lista (src/, dist/, assets)                                               |
| Licencias                     | GPL + Licencia Comercial dual                                             |
| README                        | Incluye CE vs Pro, instalación y patrocinio                               |
| GitHub Sponsors / BMC / Ko‑fi | Falta Configurados en FUNDING.yml (a la espera de aprobación de Sponsors) |
| CI / Test                     | Pendiente (se añadirá más adelante)                                       |

### 6 · Próximos pasos sugeridos

1. **CLA bot**: activar _CLA‑assistant_ en GitHub → Settings → Apps.
2. **Issue templates**: ya existen (bug_report.yml, feature_request.yml).
3. **Primer release**:
    
```
pnpm version 0.0.1
pnpm build
git push --follow-tags
gh release create 0.0.1 dist/main.js dist/manifest.json dist/styles.css -t "v0.0.1 – initial preview"
```


3. **Solicitud al directorio de plugins**: fork de obsidianmd/obsidian-releases y PR.
    
4. **Desarrollo de funcionalidad**: empezar módulos GTD, vistas React/Svelte, AI helpers.
    

## Recursos
[If you want to make a plugin in 2025, don't use the official plugin template!](https://www.reddit.com/r/ObsidianMD/comments/1k9727a/if_you_want_to_make_a_plugin_in_2025_dont_use_the/)
- GitHub: [generator-obsidian-plugin](https://github.com/mnaoumov/generator-obsidian-plugin)
	- This is an improvement over the original sample plugin template, it also comes with the [obsidian-dev-utils](https://github.com/mnaoumov/obsidian-dev-utils) package, which has a lot of amazing utility functions and benefits and offers solutions to common problems that come up when developing plugins
- Install [Yeoman](https://yeoman.io/)
	- Yeoman helps you to kickstart new projects, prescribing best practices and tools to help you stay productive.
	- To do so, we provide a generator ecosystem. A generator is basically a plugin that can be run with the `yo` command to scaffold complete projects or useful parts.
## Tareas
- [x] Creación de escenario de pruebas ✅ 2025-06-10
	- [x] Creación de carpeta en GDrive. ✅ 2025-06-10
	- [x] Copiar archivo versión anterior. ✅ 2025-06-10
	- [x] [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/RR - Recursos de uso frecuente para el desarrollo de Dovela/Ax 250610 - Sinconización de archivos md desde la boveda en producción a la boveda de desarrollo|Sinconización de archivos md para la boveda de desarrollo]] ✅ 2025-06-10
	- [x] Copiar la carpeta de  [.obsidian](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/AJBB%20Crezco360/.obsidian) del entorno en el que estoy creando mi boveda [AJBB Crezco360](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/AJBB%20Crezco360), a la carpeta en la que voy a desarrollar [Desarrollo 2025](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/Desarrollo%20Obsidian/Desarrollo%202025) para que la nueva instancia arranque sincronizada y se vean iguales: [.obsidian](file:///Users/andresborbon/Library/CloudStorage/GoogleDrive-<CUENTA>/Mi%20unidad/Desarrollo%20Obsidian/Desarrollo%202025/.obsidian) ✅ 2025-06-10

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
