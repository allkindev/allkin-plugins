# Puente Telegram

Habla con tus agentes desde Telegram. Un bot escucha en continuo (long polling: nada que abrir en
tu router, ninguna dirección pública), reenvía cada mensaje al agente que elijas y devuelve su
respuesta en el chat. Cuando el agente quiere ejecutar un comando, llega con dos botones:
**Autorizar** o **Rechazar**.

## Puesta en marcha

1. En Telegram, escribe a **@BotFather**: `/newbot`, un nombre, un identificador. Te da el
   **token** del bot.
2. Pega el token en los ajustes del plugin y escribe tu **identificador de Telegram** en
   «Usuarios autorizados» (si no lo conoces: escribe al bot, te responde con tu identificador
   cuando no está en la lista; o pregúntale a **@userinfobot**).
3. Elige el **agente por defecto** (su identificador, el de la URL de su página).
4. Concede los tres permisos, marca **Permitir el arranque como servicio**, guarda.

Escribe al bot: `/start` explica los comandos, todo lo demás va al agente.

## En el chat

| Comando       | Efecto                                                       |
|---------------|--------------------------------------------------------------|
| `/agents`     | la lista de agentes, con el comando para pasar a cada uno    |
| `/agent <id>` | este chat habla ahora con ese agente (conversación nueva)    |
| `/new`        | empieza una conversación nueva con el mismo agente           |
| `/who`        | el agente y la conversación de este chat                     |

Cada chat de Telegram conserva su conversación: sobrevive a los reinicios del plugin y de Allkin,
y aparece en el historial del agente en la interfaz. Una foto o un archivo enviado al bot se
deposita en la carpeta **Upload** del agente, que es informado.

## Conviene saber

- **Solo los identificadores listados** pueden hablar con el bot; los demás reciben un rechazo
  con su identificador, para que puedas añadirlo.
- Los **formularios** que un agente puede pedir no se rellenan desde Telegram: se cancelan con
  una explicación.
- Las validaciones de comandos desde Telegram pueden desactivarse en los ajustes: los comandos
  se rechazan entonces de entrada.
- El plugin solo habla con `api.telegram.org`, salvo que apuntes a un servidor Bot API tuyo.

## Permisos

| Permiso    | Por qué                                                                 |
|------------|-------------------------------------------------------------------------|
| Red        | consultar Telegram y devolver las respuestas, descargar los archivos    |
| Agentes    | abrir una conversación con un agente a través del socket de Allkin      |
| Archivos   | depositar los archivos recibidos en la carpeta Upload del agente        |
