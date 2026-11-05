---
type: Cmt
commit: 98c6ca3
branch: feature/smart-inbox
tagVersion: 
estado: 🟢
tags:
---
Este commit introduce la funcionalidad "Smart Inbox", una interfaz de captura rápida diseñada para añadir tareas al sistema GTD con mínima
      fricción.

Permite al usuario registrar tareas desde cualquier lugar de Obsidian mediante un cuadro de diálogo flotante que analiza el texto en
  lenguaje natural para estructurar y clasificar la tarea automáticamente.

**Características Principales:**
- **Interfaz de Captura Rápida:** Se añade el comando "Smart Inbox" que invoca una vista de entrada de texto.
- **Análisis de Sintaxis:**
	- `@proyecto`: Asocia la tarea a un archivo de proyecto específico.
    - `#cx-contexto` y `#px-persona`: Asigna contextos y personas.
    - `#GTD-AlgunDia` y `#GTD-EstaSemanaNo`: Asigna estados GTD.
    - `!date`: Permite añadir fechas de vencimiento (usando inglés: `today`, `tomorrow`, `monday`, etc.).
- **Autocompletado Dinámico:** Ofrece sugerencias para proyectos, contextos, personas y estados GTD mientras se escribe.
- **Lógica de Destino Inteligente:**
    - Las tareas sin proyecto se dirigen automáticamente a `00 - Inbox/Bandeja de entrada.md`.
    - Se añade el tag `#inbox` a cualquier tarea que no reciba una clasificación explícita.
- **Formato de Tarea Estandarizado:** Las tareas se guardan con un orden de metadatos consistente: `[tags] [fecha_creación][fecha_vencimiento]`.

