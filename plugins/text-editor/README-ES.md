# Editor de texto

Abre un archivo de la carpeta de un agente en su propia pestaña.

## Editor de código

Todo archivo de texto se abre en el editor de código: **80 lenguajes resaltados** (JavaScript,
TypeScript, Python, PHP, Go, Rust, Java, Kotlin, Swift, C/C++, C#, Ruby, SQL, YAML, JSON,
HTML/XML, CSS/SCSS, shell, PowerShell, Dockerfile, Makefile, Nginx, LaTeX…), por highlight.js.

- **Lenguaje**: detectado por el nombre del archivo (extensión, `Dockerfile`, `Makefile`, `.env`…)
  o, en su defecto, deducido del contenido. El selector del encabezado permite **elegirlo a
  mano**; la elección se recuerda para este archivo en este dispositivo. «Texto sin formato»
  desactiva el resaltado.
- **Números de línea**, ajuste de línea automático (botón; activado de entrada para el texto sin
  formato), tamaño de fuente ajustable, pantalla completa.
- **Buscar y sustituir** (Ctrl+F, Ctrl+H): coincidencia siguiente/anterior, distinción de
  mayúsculas y minúsculas, sustituir una o todas; **ir a la línea** (Ctrl+G).
- **Escribir código**: Tab / Mayús+Tab sangran la selección (unidad detectada: tabulación o
  espacios), Intro conserva la sangría y abre un bloque después de `{`, `[`, `(` o `:`,
  Ctrl+/ comenta o descomenta (sintaxis del lenguaje), Ctrl+D duplica la línea, Ctrl+S guarda
  enseguida. Deshacer (Ctrl+Z) sigue siendo el del navegador.
- **Barra de estado**: línea y columna, número de líneas, sangría, lenguaje.
- **Guardado mientras escribes**: ningún botón «Guardar».

## Markdown, imágenes, PDF

- **Markdown** se abre con formato; «Editar» pasa al editor de Markdown si el plugin
  *Editor de Markdown* está instalado, y al editor de código si no. Las imágenes y los archivos
  que se le añaden se guardan junto al documento, en `images/` y `fichiers/`.
- **Imágenes y PDF**: un simple visor.
- Copiar el contenido o la ruta, descargar el archivo.

Hasta seis archivos abiertos por agente: más allá, se cierra el más antiguo (después de guardarlo).

## Para los demás plugins

La capacidad `code-highlight`: `highlight(texto, lenguaje)`, `languageForFilename(nombre)`,
`languages()`. El explorador la usa para mostrar un script antes de ejecutarlo.

`hljs.js` se construye a partir de `node_modules/highlight.js` del repositorio allkin con
`scripts/hljs-entry.mjs` (el comando está al principio del archivo).

## Sin este plugin

Ya no hay pestaña de archivo: hacer clic en un archivo en el explorador lo descarga.

## Permiso solicitado

- **Interfaz de Allkin**: el plugin se ejecuta en la página de Allkin, con tu sesión.
