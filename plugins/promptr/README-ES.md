# Promptr

El taller de prompts de Allkin. Aquí se **dibuja** un agente: su rol, su
personalidad, sus competencias, su método… cada uno en un bloque, ajustado en
una ventana. Promptr escribe su prompt (el CLAUDE.md del agente), o hace lo
contrario: abre un prompt existente y lo ordena en bloques.

## Dos maneras de empezar

- **Abrir un prompt existente.** Pega un prompt, elige un archivo
  (`.md`, `.txt`, un `.allkin` producido por Promptr, un plan `.json`) o un
  agente ya instalado: Promptr lee su rol y lo dibuja como plan. El agente de
  origen no se modifica.
- **Partir de un plan en blanco.** Ponle nombre al agente y añade tus bloques
  uno a uno.

## El plan

Un plan es una columna de bloques, en el orden en que el prompt los recogerá:

| Bloque | Lo que ajusta |
|---|---|
| Rol y misión | quién es el agente, qué hace, para quién |
| Personalidad | tono, formalidad, concisión, humor, seguridad |
| Competencias | lo que sabe hacer, a qué nivel |
| Conocimientos | ámbitos, contexto, vocabulario |
| Método | pasos, preguntas de aclaración, incertidumbre, criterio de fin |
| Formato de las respuestas | idioma, tuteo o trato de usted, longitud, presentación |
| Alcance y límites | lo que hace, lo que no hace, sus líneas rojas |
| Ejemplos | intercambios tipo |
| Bienvenida | su primer mensaje, preguntas para empezar |
| Bloque libre | una sección a tu elección (varias posibles) |

Un clic en un bloque abre su ventana de ajuste. El «+» entre dos bloques
inserta uno en ese lugar; el asa a la izquierda de una tarjeta la mueve (o las
flechas, a la derecha). En la ventana de un bloque, **Completar con IA** lo
rellena de forma coherente con el resto del plan; reléelo antes de guardar.

## La IA en los dos sentidos

Promptr tiene **su propio agente**, «Promptr», creado por Allkin en la
instalación (ver más abajo). Es él quien hace el trabajo:

- **Plan → prompt**: *Generar el prompt* le confía el plan; él escribe el
  CLAUDE.md siguiendo las buenas prácticas de escritura (instrucciones en
  afirmativo con su razón, sin mayúsculas de énfasis, ejemplos etiquetados,
  nada inventado).
- **Prompt → plan**: abrir un prompt, o *Rehacer el plan desde este prompt*,
  le confía el texto; él devuelve el plan que describe al mismo agente. Lo que
  no cabe en ningún bloque se convierte en un bloque libre: no se pierde nada.

El panel **Prompt** siempre indica en qué punto se está: *al día con el plan*,
*retocado a mano* (se puede editar el código fuente), o *el plan ha cambiado
desde entonces*; una marca naranja también lo señala en la pestaña.

## Probar, descargar, desplegar

- **Probar** abre una conversación con un agente de prueba, «Promptr essai»,
  que recibe el prompt tal cual. No tiene **ningún permiso**: se pone a prueba
  la personalidad y las instrucciones, no las herramientas. Se proponen
  preguntas trampa (fuera de tema, ambigüedad, inyección, presión sobre una
  línea roja).
- **.allkin** descarga el agente: `agent.json`, `CLAUDE.md` y `promptr.json`
  (el plan, para volver a abrirlo en Promptr).
- **Desplegar** crea el agente en Allkin. Por defecto no tiene ningún permiso:
  marca solo lo que necesite.

## Permisos solicitados

- **Interfaz de Allkin**: la app Promptr se añade a la página de Allkin y actúa
  con tu sesión: crea el agente de prueba y, cuando lo pides, el agente final.
- **Agente dedicado**: Allkin crea el agente «Promptr», sin ningún permiso
  sobre la máquina ni sobre los demás agentes. Su rol lo proporciona el plugin
  (`agent.md`) y se restablece en cada actualización; su modelo sigue siendo
  ajustable en su página Agente. Desaparece con el plugin. Cada generación o
  análisis consume tu proveedor de IA.

El plan en curso se guarda en este navegador.
