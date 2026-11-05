---
type: Ax
estado: 🟢
tags:
---

# 🚀 Guía Rápida – Arranque de Dovela Personal Management  
**(incluye uso inicial de Copilot y métodos de compilación)**  

> Documento de referencia interna – última actualización: 11 jun 2025

---

## 1. Habilitar GitHub Copilot para el proyecto

| Entorno     | Pasos que completamos                                                                                                                                                 |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VS Code** | 1. Instalado el extensión “GitHub Copilot”.<br>2. Iniciada sesión con la cuenta de GitHub que posee la suscripción.<br>3. Configuración rápida → `settings.json`:<br> |
```json
   "github.copilot.enable": true,
   "github.copilot.enableAda": true
``` 


---

## 2. Estructura actual del repo


**obsidian-dovela-personal-management/**

│

├─ src/                  # TypeScript + Svelte/React

├─ dist/                 # Build de producción - Configurados con el template que está en [[03 - Gestion Personal/AV - Gerente de Conocimiento/AI - Sistema Gestión Personal SGP Dovela/PGTD - Sistema de Gestion Personal DOVELA/PGTD - Dovela v0.1/PGTD - Creación del repositorio y base github para Dovela#Recursos|PGTD - Creación del repositorio y base github para Dovela]]

│   ├─ build/            # Compilación para releases: `pnpm build` 

│   └─ dev/              # Ciclo abierto de compilación para desarrollo: `pnpm dev `

├─ .github/

│   ├─ FUNDING.yml       # Sponsors + BMC + Ko‑fi

│   └─ ISSUE_TEMPLATE/ …

├─ LICENSE               # GPL‑3.0‑or‑later

├─ COMMERCIAL-LICENSE_* .txt    # ES + EN

├─ README.md             # Descripción + instalación

├─ CONTRIBUTING.md       # Flujo de PR + CLA

└─ tsconfig.json, pnpm-lock.yaml, etc.


---

## 3. Dos modos de compilación

| Modo | Comando | Qué hace | Cuándo usar |
|------|---------|----------|-------------|
| **Desarrollo en caliente (watch)** | ```bash\npnpm dev\n``` | • Compila con **obsidian‑dev‑utils** en modo *watch*.<br>• Genera `main.js`, `manifest.json`, `styles.css` **in‑place** (ya estamos dentro de la ruta del plugin en la bóveda).<br>• Vuelve a compilar en cada guardado. | Trabajo diario; basta **⌘R** en Obsidian para recargar el plugin. |
| **Build de producción** | ```bash\npnpm build\n``` | • Ejecuta `svelte-check` + `tsc --build`.<br>• Genera artefactos limpios en `dist/`.<br>• Lista para empaquetar en una Release o copiar a otra bóveda. | Crear versiones etiquetadas (`v0.x.y`) y subir a GitHub Releases. |

---

## 4. Flujo recomendado (ciclo de desarrollo)

```bash
# 1. Abrir terminal en la raíz del plugin
cd ".../Desarrollo 2025/.obsidian/plugins/obsidian-dovela-personal-management"

# 2. Instalar dependencias (solo la primera vez o cuando cambie pnpm-lock)
pnpm install

# 3. Iniciar modo watch
pnpm dev            # Compila y observa cambios

# 4. En Obsidian
#    - Settings → Community Plugins → Reload plugins
#    - Pulsar ⌘R tras cada guardado de código

# 5. Antes de una Release:
pnpm build          # Build limpio en dist/
git commit -am "release: v0.1.0"
npm version 0.1.0
git push --follow-tags
gh release create 0.1.0 dist/* -t "v0.1.0 – first alpha"
````

---

## **5. Próximos hitos**

1. **Activar CLA Assistant** en GitHub → Settings → Apps.
    
2. **Añadir CI (Vitest + eslint)** con GitHub Actions.
    
3. **Publicar preview** en Obsidian Releases (community-plugins.json).
    
4. Iterar funciones GTD y dashboards con ayuda de Copilot para prototipos rápidos.
    