# Recordr

Escucha el micrófono del dispositivo en el que está abierto Allkin, escribe lo que se dice a medida
que se habla y separa a los interlocutores: un bloque por intervención, un color por voz. El
reconocimiento lo hace un **servicio de audio** conectado a Allkin — hoy
[Soniox](https://soniox.com), un servicio en línea de pago por uso.

## Puesta en marcha

1. **Servicios › Añadir › Soniox**: pegar la clave API creada en
   [console.soniox.com](https://console.soniox.com). Es el mismo gesto que para un servicio de
   imágenes: la clave la guarda Allkin, no el plugin.
2. En la página del plugin, conceder el permiso **Red**, elegir ese servicio en **Servicio de
   audio** y el **idioma hablado** (indicado, mejora el reconocimiento).
3. Marcar **Autorizar el inicio como servicio** y guardar.
4. **Abrir la página**, pulsar **Escuchar** y autorizar el micrófono cuando el navegador lo pida.

## El micrófono exige HTTPS

Un navegador solo entrega el micrófono a una página servida por **HTTPS** (o en `localhost`). Allkin
abierto por `http://192.168.x.x:9191` no lo obtendrá: hay que pasar por su dirección HTTPS
(`tailscale serve`, Caddy…). La página lo indica cuando es el caso.

## Lo que hace la página

- **Escuchar / Pausa / Detener** — el texto llega palabra a palabra. Las palabras en gris aún no son
  definitivas: el servicio puede corregirlas durante uno o dos segundos. La pastilla junto a los
  botones indica el estado de la escucha, con su duración y el nivel del micrófono. **Pausa**
  mantiene la conexión (y la numeración de las voces); tras diez minutos de pausa se suelta, y al
  reanudar se abre una nueva.
- **La escucha continúa en segundo plano** — se puede pasar a otra pestaña de Allkin, a otra pestaña
  del navegador o a otra ventana: la captura y el envío no dependen de la página mostrada. El
  navegador pide confirmación antes de cerrar o recargar la pestaña durante una escucha.
- **Reconexión automática** — si la conexión con el servicio de audio se cae, la página la
  restablece sola (durante cinco minutos como máximo) y guarda hasta veinte segundos de audio
  mientras tanto. Una línea «Escucha reanudada» marca el lugar: el servicio vuelve a numerar las
  voces, que reciben números nuevos.
- **Interlocutores** — el servicio distingue las voces; no sabe quién habla. Un clic en
  «Interlocutor 1», en el texto o en el panel de la derecha, le pone su nombre real en todas
  partes. El panel muestra el tiempo de palabra de cada uno y su parte del total.
- **Título**, **Copiar**, **Descargar (.md)** — la transcripción se exporta en Markdown, con los
  nombres y la hora de cada intervención.
- **Historial** — cada escucha se guarda en la máquina de Allkin, sobre la marcha
  (`plugin-data/recordr/data/transcripts/`). Se encuentra por su título, se reabre, se renombra y
  se elimina.

Pulsar **Escuchar** con una transcripción en pantalla empieza una nueva.

## Adónde va el audio, dónde se queda la clave

La clave del servicio de audio no sale de Allkin. En cada escucha, la página pide a Allkin una
**clave temporal** (dos minutos, el tiempo de abrir la conexión); el audio va después del navegador
directamente al servicio, sin pasar por la máquina de Allkin. El plugin no ve ninguna clave: su
servicio solo sirve la página y guarda las transcripciones.

## Límites

- **Cerrar la pestaña del plugin en Allkin, o recargar la página, detiene la escucha.** Lo transcrito
  ya está guardado.
- **Un solo micrófono para varias personas**: cuando se interrumpen o están lejos del micrófono, la
  atribución falla. Un micrófono de mesa en el centro ayuda mucho.
- **En un teléfono**, la pantalla debe seguir encendida y el navegador en primer plano: la página
  pide al sistema que no bloquee la pantalla, pero puede negarse en modo de ahorro de energía, y un
  teléfono corta el micrófono de un navegador enviado al segundo plano. Al volver, la página
  reanuda la escucha por sí sola cuando el sistema lo permite.
- **Soniox factura la duración de la conexión**, pausas incluidas (de ahí que se suelte a los diez
  minutos), y una conexión dura cinco horas como máximo; después, la página abre otra.
- **Privacidad**: el audio va al servicio de audio, desde el navegador. Grabar a personas requiere
  su consentimiento.

## Ajustes

| Ajuste | Función |
|---|---|
| Puerto local | Puerto del servicio en `127.0.0.1`; solo se cambia si ya está ocupado. |
| Servicio de audio | El servicio conectado que transcribe (añadido en **Servicios**). Obligatorio. |
| Idioma hablado | Francés, inglés, español, alemán o automático. |
| Modelo | Vacío = el modelo en tiempo real por defecto del servicio; si no, su nombre exacto. |

## Permiso solicitado

**Red** — el servicio escucha en un puerto local, para servir su página en Allkin.
