# Sleipnir

### 👉 Ver la página: **https://angeljgc-dev.github.io/sleipnir/**

Sleipnir construye la mensajería que usan los negocios pequeños de México. Su primer producto es
**Recepción IA**: contesta, agenda citas y manda recordatorios por WhatsApp, sin que el negocio
cambie de teléfono ni contrate a nadie más.

> ### Esto es un borrador
>
> La página está completa de arriba a abajo, con sus páginas de
> [privacidad](privacidad.html) y [términos](terminos.html). Lo que falta no es diseño, es
> información que no se puede inventar: el **nombre legal** de la empresa, el **domicilio**, el
> **correo** y el **WhatsApp** de contacto. Están en la página como huecos compuestos, no como
> datos falsos.
>
> Lo mismo con el aviso de privacidad: los **plazos de conservación** y la **lista de encargados
> del tratamiento** están marcados como pendientes. La lista sale de la documentación del producto,
> no de contratos firmados, y el propio aviso lo dice. Nombrar ahí a un proveedor que no interviene
> es un defecto del aviso, no un detalle de redacción.
>
> Mientras tanto la página lleva `noindex` y no sale en buscadores.

## La idea

La página se presenta como un **plano técnico**. La red de puntos no es un tapiz de fondo: está
metida dentro de una lámina con rótulo y leyenda, y cada punto es un negocio, cada línea una
conversación que pasa por Sleipnir. En la segunda sección esa misma red deja de moverse y se
convierte en un diagrama rotulado de tres pasos: ahí termina de explicarse el negocio sin que haya
que leer.

Al bajar, cada sección es un **pliego que sube sobre el anterior** y aplana sus esquinas al topar
con la barra, alternando tinta y papel. Dos piezas ocupan la pantalla completa: el producto, donde
los cuatro verbos se recorren uno a uno con su conversación al lado, y el cierre, donde la red
vuelve a pantalla completa y converge en un nudo.

El nombre se arma a partir de caracteres revueltos y **suelta la página a los 652 ms**. En ese
mismo instante aparece el primer estado del producto y late su nodo: ruido que se vuelve dato, que
es exactamente lo que hace Recepción IA cuando recibe "mañana a las 4" y saca una cita.

## Decisiones que valen la pena explicar

**Todo el contenido existe sin JavaScript.** Los tres precios, los cuatro verbos con sus trece
mensajes, los estados del producto y los enlaces legales están en el HTML. El JavaScript hace la
página espectacular; no la hace existir.

**Con "reducir movimiento" no se carga ni un byte de animación**, ni recorriendo la página entera.
Cero animaciones y cero llamadas de cuadro: no se apagan, no se piden. Y la versión estática no
invierte la jerarquía: el nombre, la frase y las dos acciones caben completos en la primera
pantalla de un teléfono.

**La red está escrita a mano y pesa 1.2 KB comprimidos.** La biblioteca más común para este efecto
pesa 33 KB para lo mismo.

**Las tipografías se sirven desde aquí, recortadas** a los caracteres que la página escribe:
Instrument Sans a 19.8 KB y Martian Mono a 2.1 KB, sin pedirle nada a un tercero y con las métricas
del respaldo ajustadas para que el texto no salte.

**Ningún precio se anima.** Las cifras están quietas y legibles desde el primer cuadro; lo que se
mueve es lo que hay alrededor.

**No hay cifras sin fuente.** Se quitó un dato de uso de WhatsApp en México que no se pudo
verificar, y no se publica ningún ejemplo de costo mensual de Meta porque la tarifa vigente no se
pudo confirmar en fuente directa. Queda la estructura, que sí es verificable: contestarle a quien
escribió primero no cuesta, y lo que se cobra son los mensajes de plantilla fuera de esa ventana.

**Sin clientes, sin logos, sin testimonios.** Hoy Sleipnir no tiene clientes y la página no dice
que los tenga.

## Medido, no estimado

Chrome con la CPU frenada cuatro veces, recorriendo la página completa con la coreografía activa:

| | Medido | Tope |
|---|---|---|
| El nombre suelta la página | 652 ms | 1,200 ms |
| Salto de contenido al cargar | 0.0000 | 0.1 |
| Salto tras el recorrido completo | 0.0354 a 390 | 0.1 |
| Peso antes del primer pintado | 46.2 KB | 150 KB |
| Peso total | 103.7 KB | 600 KB |
| Coste del cuadro, recorrido completo | 4.30 ms a 390, 4.51 ms a 1280 | 20 ms |
| Peor cuadro | 12.1 ms | 16.7 ms |
| Contraste, 240 textos sobre fondo real | ninguno bajo 7.99:1 | 7:1 |
| Con "reducir movimiento" | 0 animaciones, 0 descargas | 0 |
| Sin JavaScript | todo legible | |
| Elementos cortados o encimados, 7 anchos × 2 altos | ninguno | 0 |
| Anchos de 320 a 1920 | sin desbordar | |

El recorrido a 390 son 14.36 pantallas, que es largo. Falta probarla en Safari y en Firefox, y en un
Android de gama media real.

## Cómo correr

No hay build ni dependencias. Se abre `index.html` con doble clic, o con cualquier servidor
estático:

```bash
python -m http.server 8000
```

## Licencias

Instrument Sans y Martian Mono, SIL Open Font License 1.1. El texto completo de cada licencia, con
su aviso de copyright, está en `fuentes/`.
