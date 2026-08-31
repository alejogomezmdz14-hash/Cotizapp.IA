# Diseño — Simplificación de la interfaz móvil

Fecha: 2026-08-31
Estado: aprobado por el usuario (pendiente de plan)

## Contexto

Pedido textual del dueño del producto: *"No me gusta la interfaz del celular.
Necesitamos simplificarla para que la gente no se pierda. Está como muy robusta,
tiene que ser simple."*

El usuario real de Cotizapp es un plomero/electricista/jardinero de unos 45 años, no
técnico, usando el celular con una mano, apurado, parado en una obra. Si algo no se
entiende en dos segundos, abandona.

Se corrió una auditoría de 12 agentes sobre 10 superficies móviles leyendo el código
real: **145 hallazgos con evidencia** (archivo:línea).

## Diagnóstico

> Cotizapp no tiene una interfaz móvil: tiene una interfaz de escritorio que en el
> celular se apila.

No es una opinión, es un grep: en todo `/app` y `/components` hay **cinco** usos de
mostrar/ocultar por breakpoint (`bottom-nav.tsx:34`, `quotations-list.tsx:245`,
`quotation-form.tsx:675/718/733`) y **dos de esos son código muerto**. El resto del
producto renderiza el mismo árbol en un iPhone que en un monitor y deja que las
grillas caigan a una columna.

Datos duros del recorrido "cotizar 3 ítems y mandarlo por WhatsApp":

| Métrica | Valor |
|---|---|
| Taps totales | **22** (23 en iPhone si vence el gesto de compartir) |
| Taps solo para cargar los 3 ítems | **12** (4 por ítem) |
| Alto del dashboard antes de poder tocar algo | ~2400px, 24 lecturas numéricas |
| Alto de un ítem en la revisión de escaneo | ~700px (7 campos) |
| Scroll hasta la primera cotización en `/cotizaciones` | ~690px |
| Apariciones de `capture` en todo el repo | **0** — la cámara nunca se abre |

**Peor momento del producto:** la pantalla que aparece justo después de guardar
(`components/cotizacion/quotation-form.tsx:581-665`). Es el único punto del recorrido
sin layout móvil propio: muestra el panel de escritorio con un párrafo de jerga y
**tres botones primarios apilados** (Editar ítems / Ver cotización / Nueva cotización)
que empujan "Enviar por WhatsApp" fuera del primer pliegue.

### Temas transversales (de mayor a menor impacto)

1. **No hay app móvil, hay una de escritorio apilada.** Casi todos los demás temas son
   síntomas de este.
2. **Cada pantalla cobra peaje antes del primer dato real:** pill en mayúsculas, `h2`
   3xl/4xl, párrafo explicativo, KPIs, buscador y filtros — recién ahí, contenido.
3. **Demasiados botones primarios y el correcto nunca es el más grande.** El verde
   acento perdió significado: en el detalle hay cuatro verdes simultáneos.
4. **Tres caminos para lo mismo.** La app no es grande, es redundante.
5. **La app habla en contador; el usuario habla en oficio.** (Subtotal, Margen (%),
   Costo unitario, CAE, Razón social, "vs período anterior", "Panel principal".)
6. **El diferenciador — la foto y la IA — no abre la cámara.**
7. **Targets e inputs hechos para mouse y teclado físico.**
8. **Todo parece obligatorio y todo se confirma dos veces.**

## Decisiones tomadas

| # | Decisión | Resuelto |
|---|---|---|
| 1 | Qué significa "simple" | **Menos cosas a la vista.** Se puede esconder y eliminar, no solo reordenar |
| 2 | Qué es intocable en la navegación | **Solo Chat IA.** Gastos, Catálogo y Facturación pueden moverse |
| 3 | Dónde vive Facturación | **No es una sección.** Botón contextual en el detalle; config en Mi empresa |
| 4 | Detalle de una cotización en mobile | **Monto único por defecto**, itemizado como opción secundaria |
| 5 | Costo y margen en mobile | **Solo precio de venta.** Costo/margen en escritorio y detrás de "Ajustar" |
| 6 | Qué es el inicio en mobile | **Bandeja de trabajo.** El tablero queda en escritorio con `hidden lg:` |
| 7 | Rol del Chat IA | **Dictado que precarga el editor normal.** Se elimina su wizard paralelo |
| 8 | ARCA en mobile | **Tarea de computadora.** En el celular solo estado + explicación honesta |

## Diseño

Principio rector: **una pantalla, una acción**. Si algo no sirve para *cotizar y
mandar*, no compite por el primer pliegue.

### A. Navegación y shell

La barra inferior pasa de **6 a 5** columnas:

```
Inicio · Cotizaciones · [ + ] · Chat IA · Más
```

- **Chat IA sube** a la barra. **Clientes y Gastos bajan** a "Más": el cliente ya se
  crea dentro del flujo de cotizar (`quotation-editor-mobile.tsx:746`), no necesita
  slot propio.
- El botón central queda **sin texto**. Hoy "Cotizaciones" (truncado a "Cotizac...")
  convive con "Cotizar" en tabs contiguos: dos palabras que empiezan igual, una
  cortada. El ícono `Plus` elevado y en verde ya se explica solo.
- **Safe-area contado dos veces:** el `<nav>` mide `72px + env(safe-area-inset-bottom)`
  pero el `<ul>` tiene `h-[4.5rem]` fija **más** `paddingBottom: env(...)` adentro
  (`bottom-nav.tsx:35` vs `:39-41`). En iPhone los tabs quedan en **38px reales**, por
  debajo del mínimo táctil de 44px. Se borra el `paddingBottom` del `<ul>`.
- El botón central sube 12px con `-mt-3` pero el padding inferior del `<main>` no los
  compensa: se superpone al contenido scrolleado. Se ajusta el offset.
- **Se elimina el menú del avatar en mobile** (`hidden lg:block`): hoy conviven dos
  menús con los mismos cuatro destinos a 60cm uno del otro
  (`user-avatar-menu.tsx:62-82` vs `mobile-more-sheet.tsx:59-80`).
- Del sheet "Más" se van *Mi empresa* y *Mi perfil* (ya son tarjetas dentro de
  `/ajustes`) y *Cerrar sesión* (queda en Ajustes → Cuenta; hoy es la última fila del
  sheet, justo donde descansa el pulgar, y es la tercera copia de la misma acción).
  El sheet baja de 6 filas a 4: Clientes, Gastos, Catálogo, Ajustes.
- Se elimina el kicker **"Panel principal"** (`dashboard-header.tsx:33-35`), hardcodeado
  en el layout y por lo tanto mintiendo en 8 de 9 rutas.
- El `ThemeToggle` pasa a `hidden lg:inline-flex`: es una preferencia que se toca una
  vez en la vida ocupando uno de los dos slots de acción del header, y ya existe en
  Ajustes → Apariencia.

### B. Inicio = bandeja de trabajo

**Mobile:**
1. **"N esperando respuesta"** arriba y **tocable**, linkeando a la lista filtrada.
   Hoy es un `div` muerto (`dashboard-stat-tiles.tsx:77-85`) mientras la tile de
   ganancia neta —información de contador— sí linkea.
2. Botón Cotizar.
3. Últimas 3 cotizaciones.

De ~2400px a ~400px. **El tablero no se borra: se saca del teléfono.** Donut, gráfico
de 6 meses y KPIs completos quedan intactos en escritorio con `hidden lg:block`.

Se eliminan los dos `Sparkline` de las tiles: siempre muestran 6 meses aunque el toggle
diga "Semana" (`lib/dashboard-monthly.ts:68`), o sea contradicen su propio número.

Se corrigen los nombres contradictorios: el mismo dato se llama *pendientes* y
*Enviadas* en la misma pantalla, y conviven dos verdades de plata (*Aceptado* vs
*Cotizado*).

### C. Cotizar — el flujo principal

Camino por defecto en mobile:

```
Cliente  →  ¿Qué trabajo es?  →  ¿Cuánto cobrás?  →  Guardar
```

- **"Detallar por ítems"** queda como divulgación secundaria. El editor itemizado sigue
  existiendo completo para quien lo quiera y en escritorio.
- **Solo precio de venta.** En mobile el ítem pide qué vas a cobrar, nada más. Costo y
  margen siguen siendo editables desde el celular pero colapsados detrás de un
  "Ajustar" por ítem; en escritorio se muestran expandidos como hoy. No se borra el
  dato: se saca del camino por defecto.
- **Impuesto, validez y notas salen del camino principal** (van a "Más opciones"). La
  validez ya tiene default de 30 días.
- **Bug de validez:** el default se calcula en UTC (`quotation-expiry`) y los presets en
  hora argentina (`quotation-validity`). Después de las ~21hs no coinciden, ningún
  preset queda marcado y el usuario cree que tiene que elegir algo. Se unifica en hora
  argentina.
- **Sheet de cliente:** hoy siempre abre en el listado de guardados y "Crear cliente
  nuevo" queda al final de una lista con `max-h-45dvh`. Pasa arriba.
- El campo Teléfono del sheet no dice que es opcional y **no tiene selector de país**, a
  diferencia del alta en `/clientes`: un número local de 10 dígitos se normaliza a +549
  y el WhatsApp va a un número equivocado. Se unifica con el selector de `/clientes`.
- "Escanear factura" aparece **dos veces** (dentro del sheet de ítems y como bloque
  suelto abajo). Queda una.

### D. Después de guardar

**Mobile:** número de cotización + **"Enviar por WhatsApp"** como único botón primario,
arriba de todo. Los otros tres botones, el PDF, el enlace público y los adjuntos van
detrás de **"Más opciones"**.

**Corrección de comportamiento:** hoy la cotización se marca como *enviada* **antes** de
que el usuario elija el contacto en el menú nativo. Si cancela, la app le miente. El
cambio de estado pasa a ocurrir después de la confirmación efectiva del share.

### E. Escaneo con IA — que cumpla lo que promete

- **`capture="environment"`** en los dos inputs de foto (`invoice-dropzone.tsx:418-429`,
  `expense-form-sheet.tsx:434-444`). Los botones pasan a decir **"Sacar foto"**.
- En gastos, el botón que dice "Sacale una foto al ticket" **arranca deshabilitado**
  hasta que ya elegiste el archivo, con la explicación escondida en un atributo `title`
  que en un teléfono no existe. Se habilita y se explica en pantalla.
- **Revisión de ítems: de 7 campos a 3** por renglón (Concepto, Cantidad, Precio).
  ~700px → ~180px por ítem. Costo y margen detrás de "Ajustar".
- Se eliminan los dos `window.confirm` (`invoice-items-review.tsx:206-212` y `:233-239`):
  el propio repo ya documentó que en la PWA el diálogo nativo se descarta solo y aborta
  en silencio. Si hiciera falta confirmar, `components/ui/confirm-dialog.tsx` ya existe.

### F. Detalle de cotización

- **Un solo botón verde: "Enviar por WhatsApp"**, siempre visible. Hoy desaparece
  cuando la cotización está aceptada (`cotizaciones/[id]/page.tsx:139-140`), justo
  cuando más se quiere mandar: el usuario lo ve en la lista, entra al detalle y lo
  pierde.
- Firma, adjuntos, historial de estados, toggle pagada y facturación se agrupan como
  acciones secundarias.
- El botón **"Emitir factura"** se queda acá (contextual), con el motivo explícito
  cuando no se puede. *(Ya arreglado: la cotización "Enviada" mostraba la barra muda.)*

### G. Facturación

- **Se elimina la `/facturas` vieja**: página, componente y la acción "Convertir a
  factura". Es un segundo concepto de factura (numeración FAC, sin valor fiscal) que
  compite con ARCA y confunde. Alcance a verificar en implementación:
  `app/(dashboard)/facturas/page.tsx`, `app/actions/invoices.ts`, `lib/invoices.ts` y
  la migración asociada.
- **Mobile:** solo estado ("Factura lista" / "Falta el certificado") + botón de ver
  factura, con el texto explícito *"este paso se hace desde una computadora"*. El
  wizard del `.csr`/`.crt` queda en escritorio, donde funciona.
- **Bug a corregir:** el bloque fiscal aparece o desaparece según `profiles.country`, un
  campo que solo se carga en **otra** pantalla y que `saveBusinessProfileAction` **ni
  siquiera escribe** (`perfil-empresa/page.tsx:33` vs `app/actions/profile.ts:169`,
  `:207-226`). Además el `else` de `perfil-empresa/page.tsx:110` no renderiza nada: tiene
  que explicar por qué la sección no aparece.

### H. Chat IA

Pasa a ser **dictado que precarga el editor normal**: hablás, la IA entiende cliente y
trabajo, y te deja `/cotizaciones/nueva` precargado para revisar y guardar.

Se eliminan del chat `catalog-picker.tsx`, `cotizacion-resumen.tsx` y
`cotizacion-preview.tsx`. Hoy el chat reimplementa entero el flujo con **dos previews de
la misma cotización** y **dos formas de confirmarla** (tipear "sí" en
`chat-shell.tsx:56-83` contra un botón en `cotizacion-preview.tsx:117-131`), y ya lleva
dos comentarios defensivos para que un "dale" posterior no cree una segunda cotización
(`chat-shell.tsx:177-180`, `:475-478`).

Queda **un solo flujo de cotización** en toda la app.

### I. Bugs transversales

Se arreglan sí o sí, independientemente del rediseño:

1. **`pdf_footer` se borra solo.** Guardar los datos del negocio pisa en silencio el pie
   de página del PDF configurado en otro formulario. Cadena verificada:
   `getOptionalValue` devuelve `null` cuando el campo no está en el `FormData`
   (`app/actions/profile.ts:28-29`) → `business-profile-form.tsx` **no** manda
   `pdf_footer` → llega `null` a `buildBusinessProfileUpsertInput`
   (`app/actions/profile.ts:218`) → `lib/profile.ts:357` solo omite la columna si es
   `undefined`, así que **escribe `null`**. Fix: pasar `undefined`, patrón ya correcto
   en `lib/profile.ts:313`. **Una palabra.**
2. **Los 9 inputs de plata comen el valor.** Son `type="number"`: con el teclado latino
   "1.250,50" se borra antes de que los parsers del propio proyecto (que sí aceptan
   es-AR) lo vean. Pasan a `type="text" inputMode="decimal"`.
3. **Filtro que hace desaparecer cotizaciones.** `quotations-list.tsx:67` compara el
   status crudo mientras el badge de la misma tarjeta lo normaliza (`:268-270`): una
   cotización con badge "Enviada" desaparece al tocar el chip "Enviada".
4. **Targets de 32px.** `dropdown-menu.tsx:84` tiene `py-1.5` y gobierna los **47**
   `DropdownMenuItem` de la app — incluido "Eliminar". Pasa a `py-3` / `min-h-11`.
5. **`pb-20` redundante en 10 páginas** sobre el padding que el layout ya reserva
   (`layout.tsx:48`): ~150px de vacío que hace creer que falta contenido.
6. **Tarjetas no clickeables** en gastos, dashboard y clientes, contra la regla que el
   proyecto ya escribió para cotizaciones.
7. **Código muerto:** la barra y el spacer `xl:hidden` dentro de un form
   `hidden xl:block` (`quotation-form.tsx:718-733`, invisible en todo ancho) y las
   tarjetas decorativas de `perfil-usuario/page.tsx:40-66` que parecen botones y no
   hacen nada.

### Copy

Se reemplaza el vocabulario de software de gestión por lenguaje de oficio. Casos
concretos: *Subtotal*, *Margen (%)*, *Costo unitario*, *Concepto*, *Detalle opcional*,
*Razón social*, *Número impositivo*, *vs período anterior*, *Abrir enlace público*,
*Panel principal*. Se eliminan las 26 etiquetas `uppercase tracking` de microtipografía
de panel de control.

## Fuera de alcance

- Rediseño visual del sistema de diseño (colores, tipografía, tokens). Se respeta el
  design system actual.
- Cambios en el PDF generado.
- Rediseño del wizard ARCA para touch (decisión 8: se declara tarea de escritorio;
  se reevalúa si los datos muestran que la gente lo intenta desde el teléfono).
- Cambios en el modelo de datos de cotizaciones/ítems. El modo "monto único" se
  representa como una cotización de un solo ítem, sin migración.
- Reescritura del editor de escritorio.

## Orden de implementación

**Ola 1 — bugs y quick wins.** Bajo riesgo, alto impacto visible, sin decisiones
pendientes: los 7 bugs transversales, `capture` en la cámara, safe-area de la barra,
targets táctiles, `pb-20`, kicker del header, código muerto.

**Ola 2 — el flujo principal.** Monto único por defecto, pantalla post-guardado,
inicio como bandeja, navegación de 5 columnas, revisión de escaneo de 3 campos.

**Ola 3 — cirugía mayor.** Chat como dictado (borrado de sus componentes duplicados),
ARCA honesto en mobile, borrado de `/facturas`.

## Riesgos

- **Borrar `/facturas`** puede tener dependencias no obvias (tests, tipos, migración,
  RLS). Verificar el alcance real antes de ejecutar; el grep inicial da 29 archivos que
  mencionan `invoices`, pero la mayoría son del escaneo de facturas con IA
  (`invoice-scan`, `invoice-ai`), que **no se toca**.
- **Chat como dictado** toca el flujo que más comentarios defensivos tiene. Requiere
  cubrir con tests la no-doble-creación antes de refactorizar.
- **Monto único** no cambia el esquema, pero sí el resumen de ganancia: una cotización
  sin costo cargado no aporta margen. Verificar que el dashboard no muestre "ganancia"
  engañosa.
- Los `hidden lg:` cambian qué se renderiza por breakpoint: revisar que no se rompa el
  escritorio, que hoy es donde el producto está más terminado.
