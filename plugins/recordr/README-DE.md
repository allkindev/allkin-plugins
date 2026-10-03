# Recordr

Hört dem Mikrofon des Geräts zu, auf dem Allkin geöffnet ist, schreibt mit, was gesagt wird, während
gesprochen wird, und trennt die Sprecher: ein Block pro Redebeitrag, eine Farbe pro Stimme. Die
Erkennung übernimmt ein mit Allkin verbundener **Audiodienst** — derzeit
[Soniox](https://soniox.com), ein nach Nutzung abgerechneter Online-Dienst.

## Inbetriebnahme

1. **Dienste › Hinzufügen › Soniox**: den auf [console.soniox.com](https://console.soniox.com)
   erstellten API-Schlüssel einfügen. Es ist derselbe Schritt wie bei einem Bilddienst: Den
   Schlüssel verwahrt Allkin, nicht das Plugin.
2. Auf der Seite des Plugins das Recht **Netzwerk** gewähren, diesen Dienst unter **Audiodienst**
   wählen und die **gesprochene Sprache** (angegeben verbessert sie die Erkennung).
3. **Start als Dienst erlauben** ankreuzen, dann speichern.
4. **Seite öffnen**, **Zuhören** drücken und das Mikrofon erlauben, wenn der Browser fragt.

## Das Mikrofon verlangt HTTPS

Ein Browser gibt das Mikrofon nur einer Seite, die über **HTTPS** (oder auf `localhost`)
ausgeliefert wird. Über `http://192.168.x.x:9191` geöffnet, bekommt Allkin es nicht: Es braucht
seine HTTPS-Adresse (`tailscale serve`, Caddy…). Die Seite sagt es, wenn das der Fall ist.

## Was die Seite tut

- **Zuhören / Pause / Stoppen** — der Text kommt Wort für Wort. Graue Wörter sind noch nicht
  endgültig: Der Dienst kann sie ein, zwei Sekunden lang korrigieren. Die Anzeige neben den
  Schaltflächen sagt, wie es um das Zuhören steht, mit Dauer und Mikrofonpegel. **Pause** hält die
  Verbindung (und die Nummerierung der Stimmen); nach zehn Minuten Pause wird sie freigegeben, das
  Fortsetzen öffnet eine neue.
- **Das Zuhören läuft im Hintergrund weiter** — man kann zu einem anderen Allkin-Tab, einem anderen
  Browser-Tab oder einem anderen Fenster wechseln: Aufnahme und Versand hängen nicht von der
  angezeigten Seite ab. Der Browser fragt nach, bevor der Tab während des Zuhörens geschlossen oder
  neu geladen wird.
- **Automatische Wiederverbindung** — bricht die Verbindung zum Audiodienst ab, stellt die Seite
  sie von selbst wieder her (höchstens fünf Minuten lang) und hält bis dahin bis zu zwanzig
  Sekunden Ton zurück. Eine Linie „Zuhören fortgesetzt“ markiert die Stelle: Der Dienst nummeriert
  die Stimmen dann neu, sie erhalten neue Nummern.
- **Sprecher** — der Dienst unterscheidet die Stimmen; wer spricht, weiß er nicht. Ein Klick auf
  „Sprecher 1“, im Text oder im Bereich rechts, gibt ihm überall den richtigen Namen. Der Bereich
  zeigt die Redezeit jedes Sprechers und seinen Anteil.
- **Titel**, **Kopieren**, **Herunterladen (.md)** — das Transkript wird als Markdown exportiert,
  mit den Namen und der Zeit jedes Redebeitrags.
- **Verlauf** — jede Sitzung wird laufend auf der Maschine von Allkin gespeichert
  (`plugin-data/recordr/data/transcripts/`). Sie lässt sich über ihren Titel finden, wieder öffnen,
  umbenennen, löschen.

**Zuhören** bei angezeigtem Transkript beginnt ein neues.

## Wohin der Ton geht, wo der Schlüssel bleibt

Der Schlüssel des Audiodienstes verlässt Allkin nicht. Für jede Sitzung bittet die Seite Allkin um
einen **temporären Schlüssel** (zwei Minuten, die Zeit, die Verbindung zu öffnen); der Ton geht
danach vom Browser direkt zum Dienst, ohne über die Maschine von Allkin zu laufen. Das Plugin
selbst sieht keinen Schlüssel: Sein Dienst liefert nur die Seite aus und verwahrt die Transkripte.

## Grenzen

- **Den Tab des Plugins in Allkin zu schließen oder die Seite neu zu laden, beendet das Zuhören.**
  Das bereits Transkribierte ist gespeichert.
- **Ein Mikrofon für mehrere Personen**: Wenn man sich ins Wort fällt oder weit vom Mikrofon sitzt,
  stimmt die Zuordnung nicht. Ein Tischmikrofon in der Mitte hilft sehr.
- **Auf einem Telefon** muss der Bildschirm an und der Browser im Vordergrund bleiben: Die Seite
  bittet das System, den Bildschirm nicht zu sperren, doch es kann im Energiesparmodus ablehnen, und
  ein Telefon schaltet das Mikrofon eines Browsers im Hintergrund ab. Bei der Rückkehr setzt die
  Seite das Zuhören von selbst fort, wenn das System es zulässt.
- **Soniox berechnet die Dauer der Verbindung**, Pausen eingeschlossen (daher die Freigabe nach
  zehn Minuten), und eine Verbindung dauert höchstens fünf Stunden; danach öffnet die Seite eine
  neue.
- **Vertraulichkeit**: Der Ton geht vom Browser zum Audiodienst. Personen aufzunehmen setzt ihr
  Einverständnis voraus.

## Einstellungen

| Einstellung | Zweck |
|---|---|
| Lokaler Port | Port des Dienstes auf `127.0.0.1`; nur ändern, wenn er schon belegt ist. |
| Audiodienst | Der verbundene Dienst, der transkribiert (unter **Dienste** hinzugefügt). Pflicht. |
| Gesprochene Sprache | Französisch, Englisch, Spanisch, Deutsch oder automatisch. |
| Modell | Leer = das Standard-Echtzeitmodell des Dienstes; sonst sein genauer Name. |

## Angefordertes Recht

**Netzwerk** — der Dienst lauscht auf einem lokalen Port, um seine Seite in Allkin auszuliefern.
