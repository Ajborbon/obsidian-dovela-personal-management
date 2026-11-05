---
type: Cmt
commit: 192c3f9
branch: feature/smart-inbox
tagVersion: 
estado: 🟢
tags:
---

Se corrige un error en el Smart Inbox que impedía procesar correctamente nombres de proyectos (notas) que contenían caracteres especiales como puntos o tildes.

La expresión regular utilizada para identificar el nombre del proyecto era demasiado restrictiva (`@([\w\s-]+)`), provocando que el nombre se truncara al encontrar un carácter no estándar y que la tarea se guardara incorrectamente en la bandeja de entrada.
  
  Se ha actualizado la expresión regular a `/@([^#!]+)/`, que es más flexible y captura correctamente todo el texto después de la '@' hasta el siguiente delimitador de etiqueta (`#` o `!`), permitiendo el uso de cualquier carácter en el nombre del proyecto.
