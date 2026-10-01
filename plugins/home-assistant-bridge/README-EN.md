# Home Assistant bridge

Your agents react to what happens in the house. The plugin stays connected to Home Assistant's
websocket and applies **rules**: when an entity reaches a state (or an event happens), it wakes the
agent of your choice with the message you wrote. The agent's answer comes back into Home
Assistant, as a persistent notification or on your phone.

## Getting started

1. In Home Assistant: **Profile → Security → Long-lived access tokens → Create token**.
2. Paste Home Assistant's address and the token in the plugin's settings.
3. Write your rules, one per line.
4. Grant the two rights, tick **Allow starting as a service**, save.

## The rules

```
binary_sensor.front_door => on -> administrator : The front door just opened, check the cameras.
sensor.outdoor_temperature -> weather : It is now {state} °C outside.
light.* => on -> butler : {name} just turned on.
event:zha_event -> administrator : Zigbee event: {data}
# a line starting with # is ignored
```

| Form                            | Fires                                                  |
|---------------------------------|--------------------------------------------------------|
| `entity => state -> agent : …`  | when the entity reaches that state                     |
| `entity -> agent : …`           | on every state change of the entity                    |
| `domain.* …`                    | every entity of the domain (`*` anywhere in the id)    |
| `event:type -> agent : …`       | on every event of that type                            |

In the message: `{entity}` (the id), `{name}` (the friendly name), `{state}`, `{old}` (the
previous state), `{attrs}` (the attributes as JSON), `{data}` (the event data as JSON). The agent
gets the message as is: write it as an instruction.

## Good to know

- **One conversation per agent**, kept from one wake-up to the next and visible in its history:
  the agent keeps track of what happened.
- **The minimum delay** between two wake-ups of the same rule keeps a chatty sensor from waking
  the agent in a loop (60 s by default).
- A woken agent **cannot get a command approved**: nobody is there to answer. It is refused and
  the notification says so. Whitelist its commands if you want it to act.
- To act back on the house (turn on, close, read a state), give the agent Allkin's
  **Home Assistant** service.

## Rights

| Right   | Why                                                                  |
|---------|----------------------------------------------------------------------|
| Network | stay connected to Home Assistant's websocket, send answers back      |
| Agents  | wake the agent of a rule through Allkin's socket                     |
