# Explorador de archivos

Recorre y gestiona los archivos de los agentes desde Allkin.

## Pestaña «Archivos» de un agente

El botón de carpeta en la fila de un agente abre su espacio `data/`:

- navegación por carpetas (una fila «Carpeta superior» para subir); orden por nombre, tamaño o
  fecha (cabeceras de columna; en el teléfono, un botón «Ordenar»);
- **todo se hace desde la cabecera de la página**, con botones de icono: buscar (el filtro por
  nombre solo ocupa una fila cuando lo abres), subir archivos, nueva carpeta, nuevo archivo,
  selección; el menú ⋮ de Allkin no tiene nada que ofrecer aquí;
- **un icono por tipo**: carpeta, imagen, PDF, archivo comprimido, script, código, datos, texto…
  la papelera y la carpeta `Upload` tienen el suyo;
- un archivo recién creado se abre enseguida;
- **subida** de archivos y de carpetas enteras arrastrando y soltando, con progreso; o con el
  selector del sistema (botón «Subir» de la cabecera), la única manera en el teléfono;
- **menú contextual** (clic derecho, pulsación larga, o el botón ⋯ de cada fila): abrir,
  descargar, seleccionar, copiar, cortar, pegar, renombrar, comprimir, extraer, nuevo archivo,
  nueva carpeta, subir, eliminar;
- **selección múltiple**: botón «Selección» de la cabecera, o «Seleccionar» en un elemento.
  Aparece entonces una barra con Todo / Descargar / Mover / Eliminar / Listo; al pie de la
  pantalla en el teléfono;
- **papelera**: «Vaciar la papelera» en el menú contextual, cuando estás dentro;
- todas las confirmaciones y entradas pasan por las ventanas de Allkin, y cada acción responde con
  una burbuja;
- **archivos comprimidos** zip/tar, y descarga de una carpeta en zip;
- **ejecución de scripts** `.sh`, tras leer su contenido, con la salida en directo;
- **papelera**: lo que se elimina va a `Trash/`, que se puede vaciar aparte.

Un clic en un archivo lo abre en el plugin *Editor de texto* si está instalado, y lo descarga si
no.

## Explorador de `~/.allkin`

Desde la página de inicio, un recorrido **de solo lectura** por la carpeta de instalación de
Allkin: agentes, sesiones, copias de seguridad. Los secretos no se pueden leer ahí. Un archivo se
abre en una pestaña **visor**, sobre fondo azul: texto en bruto sin coloreado ni formato, una
imagen, un PDF, o el contenido de un archivo comprimido (zip, tar) sin extraerlo; los demás tipos
se descargan.

## Sin este plugin

Ya no hay pestaña Archivos ni explorador: desaparecen el botón de carpeta de los agentes y el
botón «Explorador» de la página de inicio. Los agentes, por su parte, conservan el acceso a sus
archivos según sus permisos.

## Permiso solicitado

- **Interfaz de Allkin**: el plugin se ejecuta en la página de Allkin, con tu sesión.
