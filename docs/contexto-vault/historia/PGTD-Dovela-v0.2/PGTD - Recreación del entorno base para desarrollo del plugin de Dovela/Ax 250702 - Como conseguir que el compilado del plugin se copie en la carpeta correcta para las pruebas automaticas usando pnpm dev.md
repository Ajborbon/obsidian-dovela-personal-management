---
type: Ax
estado: 🟢
tags:
---
Guía paso a paso: cómo conseguir que el build del plugin se copie en la carpeta correcta de Obsidian

A continuación tienes la receta que deja tu plugin listo para compilar con pnpm dev y aparecer, sin pasos adicionales, en la ruta adecuada de la bóveda. La clave fue alinear dos cosas: el id declarado en manifest.json y el name (o al menos el campo name/package) de package.json, de modo que coincidan con el nombre definitivo de la carpeta dentro de .obsidian/plugins/. Cuando esas dos piezas encajan, obsidian-dev-utils copia el contenido de dist/ justo donde Obsidian lo espera y el hot-reload funciona de inmediato.

⸻

## 1 · Configurar los metadatos del plugin

### 1.1 manifest.json

{
  "id":   "obsidian-dovela-personal-management",
  "name": "Obsidian Dovela Personal Management",
  ...
}

Por qué: Obsidian crea (o actualiza) la carpeta .obsidian/plugins/..id../ según ese campo. Si el id y la carpeta no coinciden, algunos eventos internos ni siquiera se disparan  ￼.

### 1.2 package.json

{
  "name": "obsidian-dovela-personal-management",
  ...
}

No afecta al cargador de Obsidian, pero mantener el mismo identificador evita rutas duplicadas y confusiones durante el build o la publicación.

⸻

## 2 · Definir la bóveda donde probar

obsidian-dev-utils busca la variable OBSIDIAN_CONFIG_FOLDER (o, en versiones antiguas, VAULT) para saber dónde copiar el plugin  ￼ ￼.

### 2.1 Opción recomendada — archivo .env

#### .env en la raíz del proyecto
OBSIDIAN_CONFIG_FOLDER=/Users/andresborbon/GDrive-Crezco360/Desarrollo\ Obsidian/Desarrollo\ 2025/.obsidian

Así evitas hard-codear rutas en los scripts y cada desarrollador puede apuntar a su bóveda local.

### 2.2 Script de desarrollo simplificado

en package.json
{
  "scripts": {
    "dev": "obsidian-dev-utils dev"
  }
}

Cuando ejecutas pnpm dev, la CLI lee el .env, compila a dist/ y después copia
main.js, manifest.json y styles.css a:

<bóveda>/.obsidian/plugins/obsidian-dovela-personal-management/


⸻

## 3 · Compilar y probar

pnpm install      # instala dependencias
pnpm dev          # compila, copia y vigila cambios

•	Salida primaria: dist/ (útil para empaquetar releases).
•	Copia para pruebas: .obsidian/plugins/obsidian-dovela-personal-management/
(creada automáticamente cada vez que guardas un archivo).

svelte-check y tsc se ejecutan en modo watch; si no aparecen errores, Obsidian recarga el plugin al instante.

⸻

## 4 · Buenas prácticas finales
1.	No cambies el id una vez publicado: los usuarios perderían ajustes y datos.
2.	Mantén dist/ como carpeta de salida; evita compilar directamente en la raíz del proyecto.
3.	Sincroniza id, name y la carpeta de desarrollo: facilita el debugging y el trabajo en equipo.
4.	Versiona un .env.example para que otros sepan qué variable deben definir.
5.	Documenta siempre estos pasos en tu README o en un archivo DEV_SETUP.md.

Con esta configuración ya puedes trabajar con hot-reload fiable y sin residuos en la bóveda: cada pnpm dev compila, copia y recarga el plugin en segundos.