---
type: Ax
estado: 🔵
tags:
---
# 🧾 Historial documentado de acciones Git

## 🔧 1. Inicialización del repositorio

Ejecutaste:

git init

Esto reinicializó un repositorio Git que ya existía en la carpeta del plugin. Git reconoció el .git/ ya existente y no lo sobrescribió, solo lo reafirmó como proyecto Git.

Se reestableció el proyecto al commit funcional original:

git reset --hard f03d6cb
git push origin main --force

## ✅ 2. Instalación de dependencias usando pnpm

pnpm install

Resultado:
	•	Se instalaron correctamente todos los paquetes del proyecto.
	•	Algunos scripts de postinstalación fueron omitidos por seguridad (esbuild, obsidian-typings, etc.).
	•	Se sugirió ejecutar pnpm approve-builds si se desea permitir esos scripts.

⸻

## ✅ 3. Configuración de entorno de desarrollo

### 🔧 A. Archivo .env

Se creó un archivo .env en la raíz del proyecto con esta variable:

OBSIDIAN_CONFIG_FOLDER=/Users/andresborbon/GDrive-Crezco360/Desarrollo Obsidian/Desarrollo 2025

Esto le indica a obsidian-dev-utils dónde está la bóveda activa de Obsidian para copiar automáticamente los archivos del plugin compilado.

⸻

### 🔧 B. Archivo tsconfig.json

Se agregó esta opción para evitar errores al compilar tipos de dependencias externas (como @codemirror/view):

{
  "compilerOptions": {
    ...
    "skipLibCheck": true
  }
}

Esto permite compilar sin que TypeScript revise los .d.ts de librerías de terceros.

⸻

## ✅ 4. Lanzamiento del entorno de desarrollo

pnpm dev

Esto activa el modo de desarrollo en caliente:
	•	Observa cambios en los archivos fuente (src/**)
	•	Compila automáticamente con esbuild
	•	Copia el plugin a la carpeta de plugins activa en la bóveda (.obsidian/plugins/obsidian-dovela-personal-management)
	•	Ejecuta validación de tipos con svelte-check

⸻

## ✅ 5. TAG

Se actualizó el tag v0.1.0 para que apunte a ese commit:

```sh
git tag -d v0.1.0 ## Esto fue necesario porque ya habia hecho un tag antes, pero equivocado
git tag v0.1.0 f03d6cb
git push origin v0.1.0 --force
```

⸻

✅ Resultado final
	•	El plugin está listo para desarrollo en caliente con pnpm dev
	•	La estructura base está compilando correctamente
	•	Todos los errores de tipo fueron eliminados
	•	El código está alineado con el tag v0.1.0, que ahora refleja la versión limpia y funcional

⸻
