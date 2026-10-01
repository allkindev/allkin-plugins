# Home-Assistant-Brücke

Deine Agenten reagieren auf das, was im Haus passiert. Das Plugin bleibt mit dem Websocket von
Home Assistant verbunden und wendet **Regeln** an: Erreicht eine Entität einen Zustand (oder tritt
ein Ereignis ein), weckt es den gewählten Agenten mit der Nachricht, die du geschrieben hast. Die
Antwort des Agenten kommt nach Home Assistant zurück, als dauerhafte Benachrichtigung oder auf
dein Telefon.

## Einrichtung

1. In Home Assistant: **Profil → Sicherheit → Langlebige Zugriffstoken → Token erstellen**.
2. Adresse von Home Assistant und Token in die Plugin-Einstellungen einfügen.
3. Deine Regeln schreiben, eine pro Zeile.
4. Die beiden Rechte erteilen, **Start als Dienst erlauben** anhaken, speichern.

## Die Regeln

```
binary_sensor.haustuer => on -> administrator : Die Haustür ist gerade aufgegangen, prüfe die Kameras.
sensor.aussentemperatur -> wetter : Draußen sind es jetzt {state} °C.
light.* => on -> butler : {name} wurde gerade eingeschaltet.
event:zha_event -> administrator : Zigbee-Ereignis: {data}
# eine Zeile, die mit # beginnt, wird ignoriert
```

| Form                              | Löst aus                                                 |
|-----------------------------------|----------------------------------------------------------|
| `Entität => Zustand -> Agent : …` | wenn die Entität diesen Zustand erreicht                 |
| `Entität -> Agent : …`            | bei jeder Zustandsänderung der Entität                   |
| `Domäne.* …`                      | alle Entitäten der Domäne (`*` überall in der Id)        |
| `event:Typ -> Agent : …`          | bei jedem Ereignis dieses Typs                           |

In der Nachricht: `{entity}` (die Id), `{name}` (der Anzeigename), `{state}`, `{old}` (der
vorherige Zustand), `{attrs}` (die Attribute als JSON), `{data}` (die Ereignisdaten als JSON).
Der Agent bekommt die Nachricht unverändert: Schreib sie als Anweisung.

## Gut zu wissen

- **Eine Unterhaltung pro Agent**, von einem Weckruf zum nächsten erhalten und in seinem Verlauf
  sichtbar: Der Agent behält den Faden.
- **Der Mindestabstand** zwischen zwei Weckrufen derselben Regel verhindert, dass ein
  geschwätziger Sensor den Agenten in Schleife weckt (60 s als Standard).
- Ein geweckter Agent **kann keinen Befehl freigeben lassen**: Niemand ist da, um zu antworten.
  Er wird abgelehnt, und die Benachrichtigung sagt es. Setze seine Befehle auf die Whitelist,
  wenn er handeln soll.
- Um aufs Haus zurückzuwirken (einschalten, schließen, einen Zustand lesen), gib dem Agenten den
  Dienst **Home Assistant** von Allkin.

## Rechte

| Recht    | Warum                                                                 |
|----------|-----------------------------------------------------------------------|
| Netzwerk | mit dem Websocket von Home Assistant verbunden bleiben, Antworten zurückschicken |
| Agenten  | den Agenten einer Regel über die Socket von Allkin wecken             |
