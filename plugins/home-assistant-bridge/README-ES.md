# Puente Home Assistant

Tus agentes reaccionan a lo que pasa en casa. El plugin permanece conectado al websocket de Home
Assistant y aplica **reglas**: cuando una entidad pasa a un estado (o ocurre un evento), despierta
al agente que elijas con el mensaje que escribiste. La respuesta del agente vuelve a Home
Assistant, como notificación persistente o en tu teléfono.

## Puesta en marcha

1. En Home Assistant: **Perfil → Seguridad → Tokens de acceso de larga duración → Crear token**.
2. Pega la dirección de Home Assistant y el token en los ajustes del plugin.
3. Escribe tus reglas, una por línea.
4. Concede los dos permisos, marca **Permitir el arranque como servicio**, guarda.

## Las reglas

```
binary_sensor.puerta_entrada => on -> administrador : La puerta de entrada acaba de abrirse, revisa las cámaras.
sensor.temperatura_exterior -> tiempo : Ahora hace {state} °C fuera.
light.* => on -> mayordomo : {name} acaba de encenderse.
event:zha_event -> administrador : Evento Zigbee: {data}
# una línea que empieza por # se ignora
```

| Forma                             | Dispara                                                 |
|-----------------------------------|---------------------------------------------------------|
| `entidad => estado -> agente : …` | cuando la entidad pasa a ese estado                     |
| `entidad -> agente : …`           | en cada cambio de estado de la entidad                  |
| `dominio.* …`                     | todas las entidades del dominio (`*` en cualquier parte)|
| `event:tipo -> agente : …`        | en cada evento de ese tipo                              |

En el mensaje: `{entity}` (el identificador), `{name}` (el nombre mostrado), `{state}`, `{old}`
(el estado anterior), `{attrs}` (los atributos en JSON), `{data}` (los datos del evento en
JSON). El agente recibe el mensaje tal cual: escríbelo como una instrucción.

## Conviene saber

- **Una conversación por agente**, conservada de un despertar al siguiente y visible en su
  historial: el agente sigue el hilo de lo ocurrido.
- **El intervalo mínimo** entre dos despertares de una misma regla evita que un sensor parlanchín
  despierte al agente en bucle (60 s por defecto).
- Un agente despertado **no puede hacer validar un comando**: no hay nadie para responder. Se
  rechaza y la notificación lo dice. Pon sus comandos en lista blanca si quieres que actúe.
- Para actuar sobre la casa (encender, cerrar, leer un estado), dale al agente el servicio
  **Home Assistant** de Allkin.

## Permisos

| Permiso | Por qué                                                                  |
|---------|--------------------------------------------------------------------------|
| Red     | permanecer conectado al websocket de Home Assistant, devolver respuestas |
| Agentes | despertar al agente de una regla a través del socket de Allkin           |
