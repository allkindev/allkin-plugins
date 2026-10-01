# Editor Markdown

El editor Markdown de Allkin. Escribes **en el documento con formato**: un título es un título, una
tabla es una tabla, y ninguna etiqueta (`**`, `#`, `|`…) aparece en pantalla. El archivo, en cambio,
sigue siendo Markdown corriente.

## Dónde se usa

- **Misiones**: el texto de cada ficha.
- **Rol de un agente**: la sección «Rol» de su página, y la redacción del rol en el asistente de
  creación de un agente.
- **Archivos `.md`**: con el plugin *Editor de texto*, que lo usa para los archivos Markdown.

## La barra de herramientas

| Grupo | Lo que contiene |
| --- | --- |
| Historial | Deshacer, rehacer |
| Estilo del bloque | Texto, Título 1, Título 2, Título 3; el botón siempre dice dónde estás |
| Texto | Negrita, cursiva, tachado, código, enlace |
| Listas | Viñetas, números, casillas para marcar |
| Bloques | Cita, bloque de código, tabla, separador |
| Medios | Imagen, archivo adjunto |
| Markdown en bruto | El texto tal como está escrito en el archivo |

Los botones se encienden según el lugar donde está el cursor. Pasar el ratón sobre un botón muestra
su nombre y su atajo.

## Escribir más rápido

- **`/`** al principio de una línea abre el menú de bloques: tecleas unas letras y luego <kbd>Intro</kbd>.
- Si conoces Markdown puedes seguir tecleándolo: `# `, `- `, `1. `, `[] `, `> `, `**negrita**`,
  `` `código` ``, `[texto](dirección)`… se convierten al vuelo. `---` y luego <kbd>Intro</kbd> pone un
  separador, ` ``` ` y luego <kbd>Intro</kbd> abre un bloque de código.
- Pegar Markdown, o un pasaje copiado de una página web, conserva su formato.

| Atajo | Efecto |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> / <kbd>I</kbd> / <kbd>E</kbd> | Negrita, cursiva, código |
| <kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>X</kbd> | Tachado |
| <kbd>Ctrl</kbd>+<kbd>K</kbd> | Enlace |
| <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>1</kbd>…<kbd>3</kbd>, <kbd>0</kbd> | Título 1 a 3, texto |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>, <kbd>Ctrl</kbd>+<kbd>Mayús</kbd>+<kbd>Z</kbd> | Deshacer, rehacer |
| <kbd>Tab</kbd>, <kbd>Mayús</kbd>+<kbd>Tab</kbd> | Desplazar un elemento de lista; celda siguiente o anterior |
| <kbd>Ctrl</kbd>+<kbd>Intro</kbd> | Abrir una línea bajo el bloque actual |

(<kbd>⌘</kbd> en lugar de <kbd>Ctrl</kbd> en Mac.)

## Tablas

El botón Tabla abre una cuadrícula: eliges el tamaño pasando el ratón por encima. En la tabla,
<kbd>Tab</kbd> pasa a la celda siguiente y añade una fila al final; <kbd>Intro</kbd> baja
una fila y, **en la última, sale de la tabla** para seguir escribiendo debajo. El botón
**⋯** de la celda actual inserta o quita filas y columnas, alinea la columna, elimina la
tabla.

## Enlaces, imágenes, archivos

- **Enlace**: selecciona texto y luego <kbd>Ctrl</kbd>+<kbd>K</kbd>, o pega una dirección sobre la
  selección. El cursor dentro de un enlace hace aparecer su dirección, con lo necesario para
  abrirla, cambiarla o quitarla.
- **Imagen**: con el botón Imagen, **arrastrándola al texto** (una marca muestra dónde
  caerá) o pegándola. Un clic en la imagen permite escribir su descripción o eliminarla.
- **Archivo**: el clip, o arrastrar y soltar; el archivo se guarda y se pone en el texto un enlace
  hacia él.

En un **archivo `.md`**, imágenes y archivos se guardan junto al documento (`images/`,
`fichiers/`). En otros sitios (misión, rol de un agente) una imagen se añade por su dirección web,
y un archivo soltado sobre una misión se adjunta a ella como antes.

Una **imagen remota** encontrada en un texto queda oculta mientras no hayas pedido verla:
mostrarla es enviar una petición a su servidor, y un texto escrito por un agente podría
aprovecharlo para sacar una información. Los servidores que aceptas se recuerdan.

## El archivo sigue siendo tuyo

Solo se reescriben los bloques que modificas: corregir una palabra no cambia el formato del resto
del documento. El botón **Markdown en bruto** muestra el texto exacto del archivo, y permite
corregirlo a mano.

## Sin este plugin

Estas ediciones dejan de existir: ni misiones, ni sección «Rol» (el `CLAUDE.md` de un agente sigue
en su sitio y sigue sirviendo, simplemente ya no se puede modificar desde la interfaz), y los
archivos `.md` se abren como texto sin formato. La visualización de los mensajes de los agentes no
depende de este plugin.

## Para los demás plugins

```js
const editor = Allkin.capability("markdown-editor").create({
  host,        // el elemento que recibe el documento
  toolbar,     // el que recibe la barra de herramientas (opcional)
  spellcheck,  // corrector del navegador
  doc: { getContent: () => texto, setContent: (siguiente) => { texto = siguiente; } },
  files: {     // opcional: dónde guardar imágenes y archivos
    upload: async (file) => ({ src: "images/photo.png", name: file.name }),
    resolve: (src, usage) => "/dirección/donde/leer/" + src,   // usage: "image" u "open"
  },
});
editor.render();   // luego reload(), focus("start" | "end"), isFocused(), destroy()
```

## Permiso solicitado

- **Interfaz de Allkin**: el plugin se ejecuta en la página de Allkin, con tu sesión.
