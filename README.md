# Sleipnir

### 👉 Ver la página: **https://angeljgc-dev.github.io/sleipnir/**

Sleipnir construye la mensajería que usan los negocios pequeños de México. Su primer producto es
**Recepción IA**: contesta, agenda citas y manda recordatorios por WhatsApp, sin que el negocio
cambie de teléfono ni contrate a nadie más.

> ### Esto es la portada, y es un borrador
>
> Lo que está publicado es **la primera pantalla**, no el sitio completo. Faltan las secciones de
> producto, planes y contacto, y faltan tres cosas que no se pueden inventar: el **nombre legal**
> de la empresa, el **domicilio** y las páginas de **aviso de privacidad** y **términos**, cada una
> con su URL. Hasta entonces la página lleva `noindex` y no sale en buscadores.
>
> Tampoco hay número de WhatsApp todavía: el botón apunta a la sección de contacto, no a un número
> inventado.

## La idea

La página se presenta como un **plano técnico**. La red de puntos no es un tapiz de fondo: está
metida dentro de una lámina con rótulo y leyenda, y cada punto es un negocio, cada línea una
conversación que pasa por Sleipnir. Tres nodos están clavados bajo las etiquetas `01 un negocio`,
`02 una conversación`, `03 una cita`, y late el que toca cuando la ficha de la derecha cambia de
estado.

La lámina **se disuelve antes del bloque del título**, así que ningún texto de lectura se apoya
nunca sobre el lienzo. El nombre no flota sobre partículas: está abajo, en su propia zona, como la
cartela de un plano.

El nombre se arma a partir de caracteres revueltos y **suelta la página a los 757 ms**. En ese
mismo instante aparece el primer estado del producto y late su nodo: ruido que se vuelve dato, que
es exactamente lo que hace Recepción IA cuando recibe "mañana a las 4" y saca una cita.

## Decisiones que valen la pena explicar

**Todo el contenido existe sin JavaScript.** El nombre, la frase, las dos acciones y los cuatro
estados del producto están en el HTML. El JavaScript hace la portada espectacular; no la hace
existir.

**Con "reducir movimiento" no se carga ni un byte de animación.** Ni el lienzo, ni el motor de
movimiento. Cero animaciones y cero llamadas de cuadro: no se apagan, no se piden. Y la portada
estática no reordena la jerarquía: el nombre, la frase y los dos botones caben completos en la
primera pantalla de un teléfono.

**La red está escrita a mano y pesa 1.2 KB comprimidos.** La biblioteca más común para este efecto
pesa 33 KB para lo mismo: se habría llevado ella sola el 22% del presupuesto de carga.

**Las tipografías se sirven desde aquí, recortadas.** Instrument Sans a 19.8 KB y Martian Mono a
2.1 KB, con solo los caracteres que la página escribe. Sin pedirle nada a un tercero, y con las
métricas del respaldo ajustadas para que el texto no salte mientras cargan.

**Contraste con piso de 7:1, medido sobre el fondo real.** No contra negro plano: se compone con el
lienzo pintando detrás, que es el error clásico de esta estética.

## Medido, no estimado

Chrome con la CPU frenada cuatro veces y red 4G lenta, a 390 × 844 y a 1280:

| | Medido | Tope |
|---|---|---|
| Primer pintado del elemento más grande | 532 ms | 2,500 ms |
| El nombre suelta la página | 757 ms | 1,200 ms |
| Salto de contenido al cargar | 0.0000 | 0.1 |
| Peso antes del primer pintado | 35.7 KB | 150 KB |
| Peso total | 92.1 KB | 600 KB |
| Coste del cuadro con CPU frenada | 4.17 ms a 390, 4.15 ms a 1280 | 20 ms |
| Contraste, 45 textos sobre fondo real | ninguno bajo 8.26:1 | 7:1 |
| Con "reducir movimiento" | 0 animaciones, 0 descargas | 0 |
| Sin JavaScript | todo legible | |
| Anchos de 320 a 1920 | sin desbordar | |

Falta probarla en Safari y en Firefox, y en un Android de gama media real.

## Cómo correr

No hay build ni dependencias. Se abre `index.html` con doble clic, o con cualquier servidor
estático:

```bash
python -m http.server 8000
```

## Licencias

Instrument Sans y Martian Mono, SIL Open Font License 1.1. El texto completo de cada licencia, con
su aviso de copyright, está en `fuentes/`.
