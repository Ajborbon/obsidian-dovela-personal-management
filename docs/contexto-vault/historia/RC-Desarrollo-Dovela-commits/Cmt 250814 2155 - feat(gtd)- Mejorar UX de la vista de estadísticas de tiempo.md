---
type: Cmt
commit: bec55da
branch: feat/mejoras-varias
tagVersion: 
estado: 🟢
tags:
---

Se implementan varias mejoras significativas en la **interfaz de usuario** y la **experiencia** de la vista de *Estadísticas de Tiempo* en el dashboard de GTD.

---

## Mejoras Clave

### 1. Navegación Inteligente (*Salto Inteligente*)  
- Al hacer clic en carpetas intermedias que **no** contienen registros de tiempo propios y solo tienen un subdirectorio, la vista se expande automáticamente a través de toda la cadena hasta encontrar:
  - Una bifurcación.  
  - Una nota con registros.  
- Esto reduce drásticamente los clics necesarios para explorar jerarquías profundas.

### 2. Distinción Visual de Carpetas  
- Nuevo sistema de codificación por colores para identificar visualmente los diferentes tipos de carpetas:
  - **Raíz**  
  - **Área de Vida**  
  - **Área de Interés**  
  - **Proyectos**  
- La codificación se basa en prefijos en los nombres de las carpetas.  
- Mejoras visuales:
  - Barra de color vertical a la izquierda de cada fila.  
  - El icono de carpeta coincide con el color de la barra, mejorando la legibilidad.

### 3. Limpieza de la Interfaz  
- Formato de duración más conciso (ejemplo: `45m` en lugar de `0h 45m`).

### 4. Atenuación de Nodos de Tránsito  
- Las carpetas que actúan solo como intermediarias en la jerarquía muestran sus estadísticas de forma atenuada.  
- Esto ayuda al usuario a enfocarse en los nodos que contienen información de tiempo relevante.

