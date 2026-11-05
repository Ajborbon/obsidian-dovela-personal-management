---
type: Ax
estado: 🟢
tags:
---

Realizando el desarrollo del commit 98c6ca3, se borraron cerca de 500 lineas, del commit anterior el 339f026  creo yo en su mayoria de la hoja de styles.css no lo se.. en el  commit 98c6ca3  estaba centrado en desarrollar un nuevo comando llamado Smart Inbox, pero luego de hacer el commit, me di cuenta que mientras se hacia ese desarrollo usando IA, se borraron partes del codigo que ya funcionaba muy bien en el anterior commit y al  borrarse rompi la parte visual de los botones "Vista Jerarquica", "Listas GTD" y "En progreso" y ahora no se muestra nada el boton "Time  Tracker". Quiero que revises las diferencias de código y analices cual es el código que se pudo haber borrado que afectara esas funcionalidades y   me digas como podemos recuperar esas funcionalidades. Que es mas facil desde el commit actual volver a agregar el codigo,o partiendo del codigo  del comit anterior, volver a agregar la funcionalidad del comando "Smart - Inbox"? 

Se restauro el styles.css anterior:
git checkout 339f026 -- styles.css

Los botones "Vista Jerarquica", "Listas GTD", "En progreso" y "Time  Tracker" ya funcionan correctamente. 

Se integró el codigo que estaba en el archivo src/styles/smartInbox.css al styles.css y ya funciono.

