# WeTTY

Un terminal en el navegador: [WeTTY](https://github.com/butlerx/wetty) abre una sesión SSH y la
muestra en una pestaña de Allkin. Práctico desde un teléfono o un equipo sin cliente SSH.

## Puesta en marcha

1. Concede los tres permisos (más abajo se explica por qué).
2. Comprueba los ajustes: por defecto, el terminal se conecta por SSH a la máquina de Allkin
   (`localhost:22`) y pide el nombre de usuario y luego la contraseña.
3. Marca **Autorizar el inicio como servicio** y guarda.
4. **Abrir la página**.

En el **primer inicio**, WeTTY se descarga desde npm y su módulo nativo `node-pty` se compila
para la máquina: cuenta de diez segundos a un minuto. El registro del servicio muestra el
avance; mientras no haya terminado, la página responde «El plugin no responde»: recárgala
después. Los inicios siguientes son inmediatos.

## Por qué SSH, incluso hacia la máquina local

WeTTY solo abre un shell local directamente si se ejecuta como root, lo que no es el caso de
Allkin. Pasa por tanto por el servidor SSH, lo que tiene una ventaja: **abrir el terminal pide
las credenciales del sistema**, además de la sesión de Allkin. El servidor SSH debe estar
instalado y aceptar la autenticación elegida (`sudo apt install openssh-server` en Debian/Ubuntu).

## Ajustes

| Ajuste            | Función                                                              |
|-------------------|----------------------------------------------------------------------|
| Puerto local      | Puerto de escucha de WeTTY en `127.0.0.1` (por defecto 9310)         |
| Servidor SSH      | La máquina en la que abrir el terminal (por defecto `localhost`)     |
| Puerto SSH        | Por defecto 22                                                       |
| Usuario SSH       | Vacío: se pide en cada apertura                                      |
| Autenticación     | Contraseña, o clave y luego contraseña                               |
| Clave privada SSH | Ruta de una clave. Sin frase de contraseña, ya no se pide nada: en ese caso solo la sesión de Allkin protege el terminal |
| Título            | El título de la ventana del terminal                                 |

## Permisos solicitados

- **Red**: descarga de WeTTY desde npm, escucha en el puerto local, conexión SSH.
- **Comandos del sistema**: npm en la instalación y luego ssh; y el terminal ejecuta lo que
  escribes.
- **Archivos fuera de su carpeta**: un terminal ve todo lo que ve la cuenta conectada.

## Detalles

- WeTTY se instala en la carpeta de datos del plugin (`runtime/`), que se conserva en las
  actualizaciones del plugin. Eliminar esta carpeta fuerza una reinstalación en el siguiente inicio.
- La página se sirve bajo `/plugins/wetty/web` (opción `--base`) y Allkin la retransmite,
  WebSocket incluido: nunca queda expuesta directamente en la red.
