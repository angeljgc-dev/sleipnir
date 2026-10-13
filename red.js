/* Red de nodos: cada punto es un negocio, cada linea una conversacion.

   El 01 esta clavado debajo de su ancla del HTML y no se mueve nunca. Todo lo
   demas es consecuencia de un recorrido: sale una curva ambar del 01, toca un
   nodo y ahi aparece el 02; vuelve a salir, toca otro nodo y ahi aparece el 03;
   despues las dos lineas se recogen, las dos etiquetas se van y queda otra vez
   solo el 01. La vuelta siguiente va a otros destinos y en otra direccion. Las
   etiquetas no estan puestas de adorno: existen porque el mensaje llego.

   Los destinos no se inventan encima del dibujo, son paradas: nodos de la red
   clavados en sitios donde una etiqueta cabe entera sin tocar la leyenda, ni la
   ficha, ni el filo de la lamina. El sitio se comprueba al medir, antes de que
   la etiqueta exista, asi que no hay manera de que una aparezca encimada o
   fuera. Las dos posiciones que el CSS reserva para el 02 y el 03 entran en la
   bolsa como dos paradas mas, y son las que sostienen la lamina de un telefono,
   donde el rotulo y la ficha casi no dejan sitio libre.

   El mensaje avanza por longitud de arco, no por el parametro de la curva: con
   la t de la bezier la velocidad cambia donde la curva se cierra y se nota. El
   trazo se descubre y se recoge con setLineDash y lineDashOffset, que ya
   trabajan en esas unidades; la tabla de arco solo hace falta para medir la
   curva y para poner la cabeza. Un reloj para la vuelta entera.

   Va como script clasico a proposito: la portada se abre con doble clic, y los
   modulos ES no cargan desde file://. */
(function (global) {
  function redDeNodos(canvas, opciones) {
    var o = opciones || {};
    var ctx = canvas.getContext('2d', { alpha: true });
    var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var densidad = o.densidad || 5600;      // un nodo por cada N px2 de CSS
    var maxNodos = o.maxNodos || 82;
    var radioEnlace = o.radioEnlace || 128;
    var radioPuntero = o.radioPuntero || 150;
    var tinta = o.tinta || '236,234,228';
    var acento = o.acento || '255,179,87';
    var vel = quieto ? 0 : (o.velocidad == null ? 0.2 : o.velocidad);

    var dpr = 1, an = 0, al = 0, nodos = [], anclas = [];
    var px = -9999, py = -9999, rafId = 0, t = 0, dentro = true;

    // El reparto de una vuelta, en ms.
    var TRAZA = 1000;        // lo que tarda la linea en cubrir un tramo
    var PAUSA = 460;         // lo que espera en el nodo antes de volver a salir
    var LEE = 1700;          // los tres puestos y quietos, para que se lean
    var BORRA = 740;         // las lineas recogiendose y las etiquetas saliendo
    var LLEGA = TRAZA + PAUSA + TRAZA;        // cuando el mensaje entra en el 03
    var VUELTA = LLEGA + LEE + BORRA;
    var COMBAS = [0.12, 0.2, 0.28, 0.38];   // cuanto se puede separar la curva de la cuerda
    var AIRE = 3;            // el aire que se le deja a una etiqueta
    var CERCA = 18;          // lo que se perdona alrededor de cada punta de una curva
    var PARADAS = 5;         // paradas de sobra, ademas de las dos del CSS

    var tapan = [], tams = [], paradas = [], chapa01 = null, enVuelo = null;
    var parAnterior = -1, ultima = null;

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      an = canvas.clientWidth;
      al = canvas.clientHeight;
      if (!an || !al) return;
      canvas.width = Math.round(an * dpr);
      canvas.height = Math.round(al * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Una vuelta a medias no sobrevive a un cambio de tamano: sus destinos
      // estaban medidos contra la lamina de antes.
      tira();
      var cuantos = Math.max(18, Math.min(maxNodos, Math.round((an * al) / densidad)));
      cuantos += anclas.length + PARADAS;
      while (nodos.length > cuantos) nodos.pop();
      while (nodos.length < cuantos) nodos.push(nuevo());
      colocarAnclas();
    }

    function nuevo() {
      var a = Math.random() * Math.PI * 2;
      return {
        x: Math.random() * an, y: Math.random() * al,
        vx: Math.cos(a) * vel, vy: Math.sin(a) * vel,
        r: 1.2 + Math.random() * 1.7,
        ax: 0, ay: 0,
        pulso: 0, fijo: false
      };
    }

    // Las anclas llegan en pixeles de CSS, medidas sobre el DOM: asi el diseno
    // manda sobre la posicion y el canvas solo la sigue. Con ellas llegan las
    // cajas de lo que esta encima y es opaco, y el tamano de cada rotulo. Lo
    // que pase por detras de una chapa no se ve, asi que ni el recorrido pasa
    // por ahi ni una etiqueta aparece ahi.
    function setAnclas(lista, cajas, medidas) {
      anclas = lista || [];
      tapan = cajas || [];
      tams = medidas || [];
      medir();
    }

    function colocarAnclas() {
      for (var i = 0; i < nodos.length; i++) nodos[i].fijo = false;
      for (var j = 0; j < anclas.length && j < nodos.length; j++) {
        var n = nodos[j];
        n.x = n.ax = anclas[j][0]; n.y = n.ay = anclas[j][1];
        n.vx = n.vy = 0; n.fijo = true;
        // El 01 esta siempre puesto y su punto lo dibuja el HTML. Los otros dos
        // son paradas como las demas: mientras no hay etiqueta encima, lo que
        // se ve ahi es un nodo cualquiera de la red.
        n.r = j === 0 ? 0 : 1.9;
      }
      marcaParadas();
    }

    /* ---------------- las paradas: donde cabe una etiqueta ---------------- */

    // Que sitio ocupa un rotulo colgado de un punto. Por omision cuelga a la
    // derecha, como el del 01; colgarlo a la izquierda es la mitad de los
    // sitios posibles en una lamina de telefono.
    function cajaRotulo(x, y, w, h, izq) {
      var x0 = izq ? x + 5 - w : x - 5;
      return [x0, y - h / 2, x0 + w, y + h / 2];
    }

    function cruza(b, c) {
      return b[0] < c[2] + AIRE && b[2] > c[0] - AIRE &&
             b[1] < c[3] + AIRE && b[3] > c[1] - AIRE;
    }

    function libre(b) {
      if (b[0] < AIRE || b[1] < AIRE || b[2] > an - AIRE || b[3] > al - AIRE) return false;
      if (chapa01 && cruza(b, chapa01)) return false;
      for (var i = 0; i < tapan.length; i++) if (cruza(b, tapan[i])) return false;
      return true;
    }

    function d2(a, b) {
      var dx = a[0] - b[0], dy = a[1] - b[1];
      return dx * dx + dy * dy;
    }

    // Las dos etiquetas no miden lo mismo: "02 una conversacion" es 62 px mas
    // ancha que "03 una cita". En la lamina de un telefono esa diferencia es la
    // mitad de los sitios posibles, asi que de cada parada se guarda, para cada
    // una de las dos etiquetas, la caja que ocuparia colgando a la derecha y la
    // que ocuparia colgando a la izquierda, con null donde no cabe. De que lado
    // cuelga no se decide aqui: lo decide el recorrido de cada vuelta.
    function parada(i, x, y) {
      var p = { i: i, p: [x, y], caja: [null, [null, null], [null, null]] }, vale = false;
      for (var k = 1; k < 3; k++) {
        for (var l = 0; l < 2; l++) {
          var b = cajaRotulo(x, y, tams[k][0], tams[k][1], l === 1);
          if (libre(b)) { p.caja[k][l] = b; vale = true; }
        }
      }
      return vale ? p : null;
    }

    function marcaParadas() {
      paradas = [];
      chapa01 = null;
      if (anclas.length < 3 || tams.length < 3) return;
      var o = anclas[0];
      // El rotulo del 01 esta siempre puesto y cuelga a la derecha de su punto:
      // es la chapa que mas estorba de la lamina, y de la que el recorrido
      // tiene que salir.
      chapa01 = cajaRotulo(o[0], o[1], tams[0][0], tams[0][1], false);
      var sep = Math.max(52, Math.min(an, al) * 0.2);
      // Mas abajo del 72% la mascara del canvas ya se come la linea, y una
      // etiqueta a la que no se le ve llegar el mensaje no cuenta.
      var techo = al * 0.72;
      var alto = Math.max(tams[1][1], tams[2][1]);
      var k, pa;

      // Las dos posiciones que el CSS reserva van primero: son las que
      // sostienen la lamina estrecha, donde el rotulo y la ficha dejan dos
      // franjas y nada mas.
      for (k = 1; k < 3; k++) {
        pa = parada(k, anclas[k][0], anclas[k][1]);
        if (pa) paradas.push(pa);
      }

      var cand = [];
      for (var y = alto / 2; y < techo; y += 8) {
        for (var x = 0; x <= an; x += 8) {
          if (d2([x, y], o) < sep * sep) continue;
          // Nada de paradas justo detras del rotulo del 01: la etiqueta cabria,
          // pero la linea tendria que salir escondida debajo de esa chapa todo
          // el rato, y una cuna que se abre hacia la derecha es lo que no se
          // puede esquivar con mas comba.
          if (x > o[0] + 8 && Math.abs(y - o[1]) < 15 + (x - o[0]) * 0.08) continue;
          if (libre(cajaRotulo(x, y, tams[2][0], tams[2][1], false)) ||
              libre(cajaRotulo(x, y, tams[2][0], tams[2][1], true))) cand.push([x, y, 0]);
        }
      }
      if (!cand.length) return;

      // Muestreo del mas lejano, con algo de azar entre los que empatan: las
      // paradas quedan repartidas por la lamina y no apelotonadas en una
      // esquina, y no salen siempre las mismas.
      var sueltos = [];
      for (var i = anclas.length; i < nodos.length; i++) if (!nodos[i].fijo) sueltos.push(i);

      while (paradas.length < 2 + PARADAS && sueltos.length) {
        var lejos = [], tope = 0, j;
        for (j = 0; j < cand.length; j++) {
          var d = d2(cand[j], o);
          for (var q = 0; q < paradas.length; q++) {
            var e = d2(cand[j], paradas[q].p);
            if (e < d) d = e;
          }
          cand[j][2] = d;
          if (d > tope) tope = d;
        }
        if (tope < sep * sep) break;
        for (j = 0; j < cand.length; j++) if (cand[j][2] >= tope * 0.6) lejos.push(cand[j]);
        var c = lejos[(Math.random() * lejos.length) | 0];

        // La parada se queda con el nodo suelto mas cercano: el destino es un
        // nodo de la red de verdad, no un punto puesto encima de ella.
        var cual = 0;
        for (var s = 1; s < sueltos.length; s++) {
          if (d2([nodos[sueltos[s]].x, nodos[sueltos[s]].y], c) <
              d2([nodos[sueltos[cual]].x, nodos[sueltos[cual]].y], c)) cual = s;
        }
        pa = parada(sueltos[cual], c[0], c[1]);
        if (pa) {
          var n = nodos[sueltos[cual]];
          n.x = n.ax = c[0]; n.y = n.ay = c[1];
          n.vx = n.vy = 0; n.fijo = true;
          paradas.push(pa);
          sueltos.splice(cual, 1);
        } else {
          // el sitio dejo de valer entre la busqueda y el reparto: se descarta
          cand.splice(cand.indexOf(c), 1);
          if (!cand.length) break;
        }
      }
    }

    /* ---------------- la curva de un tramo ---------------- */

    // Una recta de 01 a 02 saldria por debajo de la etiqueta del 01, que cuelga
    // del punto. Por eso el tramo es una curva que se comba para salir de ahi;
    // cuanto y hacia que lado lo decide quien la pide.
    function curva(a, b, lado, comba) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var cuerda = Math.sqrt(dx * dx + dy * dy);
      if (cuerda < 24) return null;
      var f = comba * lado;
      var c = [(a[0] + b[0]) / 2 - dy * f, (a[1] + b[1]) / 2 + dx * f];

      // Tabla de longitud de arco. Canvas no tiene getPointAtLength, asi que se
      // muestrea una vez por medida y de ahi salen el largo de la curva y la
      // posicion de la cabeza.
      var N = 40, pts = [], acc = [0], largo = 0, ax = a[0], ay = a[1];
      for (var i = 0; i <= N; i++) {
        var p = i / N, u = 1 - p;
        var x = u * u * a[0] + 2 * u * p * c[0] + p * p * b[0];
        var y = u * u * a[1] + 2 * u * p * c[1] + p * p * b[1];
        pts.push(x, y);
        if (i) { largo += Math.sqrt((x - ax) * (x - ax) + (y - ay) * (y - ay)); acc.push(largo); }
        ax = x; ay = y;
      }
      return { a: a, b: b, c: c, pts: pts, acc: acc, L: largo };
    }

    function tapado(x, y, cajas) {
      for (var j = 0; j < cajas.length; j++) {
        var b = cajas[j];
        if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) return true;
      }
      return false;
    }

    // Cuanto del tramo queda escondido, en muestras de 41. Las chapas de los
    // dos rotulos del propio tramo cuelgan de sus puntos, asi que la curva sale
    // por detras de la del arranque quiera o no: eso se perdona, hasta un tope,
    // porque una linea que asoma de debajo de la etiqueta del 01 se lee bien.
    // Lo que no se perdona es la segunda mitad: una linea que entra al nodo por
    // detras de su propio rotulo no se ve llegar, y la llegada es justo lo que
    // esta vuelta tiene que contar. Lo ajeno no se perdona nunca.
    function escondido(cu, ajenas, propias) {
      var n = cu.pts.length / 2, fuera = 0, mias = 0;
      for (var i = 0; i < n; i++) {
        var x = cu.pts[i * 2], y = cu.pts[i * 2 + 1];
        if (d2([x, y], cu.a) < CERCA * CERCA) continue;
        if (d2([x, y], cu.b) < CERCA * CERCA) continue;
        if (tapado(x, y, ajenas)) { fuera++; continue; }
        if (tapado(x, y, propias)) { if (i * 2 < n) mias++; else fuera++; }
      }
      return fuera * 100 + mias;
    }

    // Se prueban las dos combas y los dos lados, de menos a mas, y se queda la
    // primera que cumple el tope. En un telefono de 320 el lado bueno es el
    // contrario que en un escritorio, y asi no hay que escribir dos reglas. Con
    // el tope de par en par vale la menos escondida, que es mejor que no salir.
    function curvaDe(a, b, ajenas, propias, tope) {
      var mejor = null;
      for (var c = 0; c < COMBAS.length; c++) {
        for (var l = 1; l >= -1; l -= 2) {
          var cu = curva(a, b, l, COMBAS[c]);
          if (!cu) return null;
          var m = escondido(cu, ajenas, propias);
          if (m <= tope) return cu;
          if (!mejor || m < mejor.m) mejor = { m: m, cu: cu };
        }
      }
      return tope > 1e5 ? (mejor && mejor.cu) : null;
    }

    /* ---------------- una vuelta ---------------- */

    // Tres columnas por dos renglones. Sirve para una sola cosa: que dos
    // vueltas seguidas no acaben en el mismo sitio.
    function zona(p) {
      var c = Math.min(2, (p[0] / an * 3) | 0);
      var r = Math.min(1, (p[1] / al * 2) | 0);
      return r * 3 + c;
    }

    // Si el 02 quedo por abajo, el 03 se busca por arriba. Es lo que hace que
    // una vuelta no se parezca a la de antes aunque los destinos esten cerca.
    function alterna(o, p1, p2) {
      var a = p1[1] - o[1], b = p2[1] - p1[1];
      return (a > 6 && b < -6) || (a < -6 && b > 6);
    }

    // El rotulo cuelga al lado contrario de donde va la linea: el del 02 al
    // reves de por donde sale hacia el 03, y el del 03 al reves de por donde
    // llega. Es una preferencia, no una regla; si no sale, se prueba el otro
    // lado y manda la cuenta de lo escondido.
    function ladoAlReves(desde, hacia) {
      return hacia[0] >= desde[0] ? [1, 0] : [0, 1];
    }

    function eligeDestinos() {
      if (paradas.length < 2 || anclas.length < 3 || !chapa01) return null;
      var o = anclas[0], pares = [], i, j;
      for (i = 0; i < paradas.length; i++) {
        for (j = 0; j < paradas.length; j++) if (i !== j) pares.push([i, j]);
      }
      for (i = pares.length - 1; i > 0; i--) {
        j = (Math.random() * (i + 1)) | 0;
        var v = pares[i]; pares[i] = pares[j]; pares[j] = v;
      }

      // Cuatro pasadas, de la mas exigente a la que se conforma: direcciones
      // alternadas y par nuevo; par nuevo; par nuevo aunque la linea se
      // esconda algo mas; y al final cualquier par, quedandose con el menos
      // escondido de todos y no con el primero que salga. En la lamina de un
      // telefono el sitio libre da para poco, y una vuelta repetida es mejor
      // que ninguna, pero una que no se vea no vale de nada.
      var topes = [8, 8, 14, 1e9];
      var mejor = null;
      for (var pas = 0; pas < 4; pas++) {
        for (var k = 0; k < pares.length; k++) {
          var a = paradas[pares[k][0]], b = paradas[pares[k][1]];
          if (d2(a.p, b.p) < 24 * 24 || d2(o, b.p) < 24 * 24) continue;
          if (pas < 3 && zona(a.p) * 10 + zona(b.p) === parAnterior) continue;
          if (pas < 1 && !alterna(o, a.p, b.p)) continue;

          var la = ladoAlReves(a.p, b.p), lb = ladoAlReves(b.p, a.p);
          for (var u = 0; u < 2; u++) {
            var ca = a.caja[1][la[u]];
            if (!ca) continue;
            for (var w = 0; w < 2; w++) {
              var cb = b.caja[2][lb[w]];
              if (!cb || cruza(ca, cb)) continue;
              var aj1 = tapan.concat([cb]), pr1 = [chapa01, ca];
              var aj2 = tapan.concat([chapa01]), pr2 = [ca, cb];
              var c1 = curvaDe(o, a.p, aj1, pr1, topes[pas]);
              if (!c1) continue;
              var c2 = curvaDe(a.p, b.p, aj2, pr2, topes[pas]);
              if (!c2) continue;
              var hecho = { paradas: [a, b], tramos: [c1, c2], izq: [la[u] === 1, lb[w] === 1] };
              if (pas < 3) return hecho;
              var m = escondido(c1, aj1, pr1) + escondido(c2, aj2, pr2);
              if (!mejor || m < mejor.m) mejor = { m: m, v: hecho };
            }
          }
        }
      }
      return mejor && mejor.v;
    }

    function vuelta(reporta) {
      if (quieto || enVuelo || !dentro || document.hidden) return 0;
      var d = eligeDestinos();
      if (!d) return 0;
      enVuelo = {
        t0: performance.now(), hito: 0,
        tramos: d.tramos, paradas: d.paradas, reporta: reporta
      };
      parAnterior = zona(d.paradas[0].p) * 10 + zona(d.paradas[1].p);
      ultima = { zonas: [zona(d.paradas[0].p), zona(d.paradas[1].p)],
                 puntos: [d.paradas[0].p, d.paradas[1].p] };
      if (reporta) reporta('sitios', [
        { p: d.paradas[0].p, izq: d.izq[0] },
        { p: d.paradas[1].p, izq: d.izq[1] }
      ]);
      mensaje(0);
      return VUELTA;
    }

    // Al tirar una vuelta a medias se avisa de las dos etiquetas: si no, se
    // quedarian puestas en un sitio que ya no existe.
    function tira() {
      if (!enVuelo) return;
      var r = enVuelo.reporta;
      enVuelo = null;
      if (r) { r('borra', 2); r('borra', 1); }
    }

    function avisa(n) {
      var p = enVuelo.paradas, r = enVuelo.reporta;
      if (n === 1) { mensaje(p[0].i); if (r) r('llega', 1); }
      else if (n === 2) { mensaje(p[1].i); if (r) r('llega', 2); }
      else if (n === 3) { if (r) r('borra', 2); }
      else if (n === 4) { if (r) r('borra', 1); }
    }

    function dibuja(cu) {
      ctx.beginPath();
      ctx.moveTo(cu.a[0], cu.a[1]);
      ctx.quadraticCurveTo(cu.c[0], cu.c[1], cu.b[0], cu.b[1]);
    }

    // Punto de la curva a una distancia dada del arranque.
    function enArco(cu, s) {
      var a = cu.acc, n = a.length - 1;
      if (s <= 0) return [cu.pts[0], cu.pts[1]];
      if (s >= cu.L) return [cu.pts[n * 2], cu.pts[n * 2 + 1]];
      var lo = 0, hi = n, m;
      while (lo + 1 < hi) { m = (lo + hi) >> 1; if (a[m] <= s) lo = m; else hi = m; }
      var f = (s - a[lo]) / (a[hi] - a[lo]);
      return [cu.pts[lo * 2] + (cu.pts[hi * 2] - cu.pts[lo * 2]) * f,
              cu.pts[lo * 2 + 1] + (cu.pts[hi * 2 + 1] - cu.pts[lo * 2 + 1]) * f];
    }

    function pintaVuelta(ahora) {
      if (!enVuelo) return;
      var e = ahora - enVuelo.t0;

      // Los avisos salen todos los que falten, no solo el del momento de ahora:
      // un cuadro perdido dejaria una etiqueta sin aparecer.
      var f = 0;
      if (e >= TRAZA) f = 1;
      if (e >= LLEGA) f = 2;
      if (e >= LLEGA + LEE) f = 3;
      if (e >= LLEGA + LEE + BORRA * 0.42) f = 4;
      if (e >= VUELTA) f = 5;
      while (enVuelo.hito < f) avisa(++enVuelo.hito);
      if (!enVuelo || f >= 5) { enVuelo = null; return; }

      var uno = enVuelo.tramos[0], dos = enVuelo.tramos[1];
      var v0 = 0, v1 = 0, cab = -1, s = 0, w;

      if (e < TRAZA) {
        // sale del 01 de golpe y frena al llegar
        w = e / TRAZA;
        v0 = (1 - (1 - w) * (1 - w)) * uno.L;
        cab = 0; s = v0;
      } else if (e < TRAZA + PAUSA) {
        v0 = uno.L;
      } else if (e < LLEGA) {
        // toma vuelo al salir del 02 y vuelve a frenar en el 03
        w = (e - TRAZA - PAUSA) / TRAZA;
        v0 = uno.L;
        v1 = w * w * (3 - 2 * w) * dos.L;
        cab = 1; s = v1;
      } else if (e < LLEGA + LEE) {
        v0 = uno.L; v1 = dos.L;
      } else {
        // Todo regresa: las lineas se recogen hacia el 01, la de atras primero,
        // y cada etiqueta se va cuando su linea la suelta.
        var q = (e - LLEGA - LEE) / BORRA;
        v1 = (1 - Math.min(1, q / 0.58)) * dos.L;
        v0 = (1 - Math.max(0, (q - 0.42) / 0.58)) * uno.L;
        if (v1 > 1) { cab = 1; s = v1; } else if (v0 > 1) { cab = 0; s = v0; }
      }

      ctx.lineCap = 'round';
      ctx.lineWidth = 1.7;
      ctx.strokeStyle = 'rgba(' + acento + ',0.62)';
      if (v0 > 0) {
        ctx.setLineDash([v0, uno.L + 2]);
        dibuja(uno); ctx.stroke();
      }
      if (v1 > 0) {
        ctx.setLineDash([v1, dos.L + 2]);
        dibuja(dos); ctx.stroke();
      }
      ctx.setLineDash([]);

      if (cab < 0) { ctx.lineCap = 'butt'; ctx.lineWidth = 1; return; }

      // La cabeza son tres pasadas del mismo trazo, cada vez mas corta y mas
      // encendida. Un shadowBlur daria el mismo halo y obliga al navegador a
      // rasterizar aparte en cada cuadro.
      var cu = cab === 0 ? uno : dos;
      var seg = Math.max(24, cu.L * 0.2);
      var gruesos = [5, 2.8, 1.5], alfas = [0.11, 0.3, 0.95];
      for (var k = 0; k < 3; k++) {
        var largo = seg * (1 - k * 0.3);
        ctx.setLineDash([largo, cu.L + seg]);
        ctx.lineDashOffset = largo - s;
        ctx.lineWidth = gruesos[k];
        ctx.strokeStyle = 'rgba(' + acento + ',' + alfas[k] + ')';
        dibuja(cu); ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      var h = enArco(cu, s);
      ctx.beginPath(); ctx.arc(h[0], h[1], 4.6, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + acento + ',0.2)'; ctx.fill();
      ctx.beginPath(); ctx.arc(h[0], h[1], 2.2, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + acento + ',1)'; ctx.fill();
      ctx.lineCap = 'butt';
      ctx.lineWidth = 1;
    }

    // Sin indice late un negocio cualquiera, nunca una parada ni el 01: esos
    // solo se encienden cuando pasa el mensaje.
    function pulse(i) {
      var k;
      if (i == null) {
        var sueltos = [];
        for (var j = anclas.length; j < nodos.length; j++) if (!nodos[j].fijo) sueltos.push(j);
        if (!sueltos.length) return;
        k = sueltos[(Math.random() * sueltos.length) | 0];
      } else k = i % nodos.length;
      var n = nodos[k];
      if (n) n.pulso = 1;
    }

    // Un mensaje no enciende un punto suelto: enciende el nodo y arrastra a sus
    // vecinos mas cercanos, que es lo que hace una conversacion al pasar.
    function mensaje(i) {
      var k = i == null ? 0 : i % nodos.length;
      var a = nodos[k];
      if (!a) return;
      a.pulso = 1;
      var cerca = [];
      for (var j = 0; j < nodos.length; j++) {
        if (j === k) continue;
        var dx = nodos[j].x - a.x, dy = nodos[j].y - a.y;
        cerca.push([dx * dx + dy * dy, j]);
      }
      cerca.sort(function (p, q) { return p[0] - q[0]; });
      for (var c = 0; c < 3 && c < cerca.length; c++) nodos[cerca[c][1]].pulso = 0.78 - c * 0.18;
      return k;
    }

    function cuadro(ahora) {
      t++;
      ahora = ahora || performance.now();
      ctx.clearRect(0, 0, an, al);

      for (var i = 0; i < nodos.length; i++) {
        var n = nodos[i];
        if (!n.fijo) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < 0) { n.x = 0; n.vx = -n.vx; } else if (n.x > an) { n.x = an; n.vx = -n.vx; }
          if (n.y < 0) { n.y = 0; n.vy = -n.vy; } else if (n.y > al) { n.y = al; n.vy = -n.vy; }
        }
        n.ax = n.x; n.ay = n.y;
        if (n.pulso > 0) n.pulso -= 0.013;
      }

      // enlaces entre nodos
      var r2 = radioEnlace * radioEnlace;
      ctx.lineWidth = 1;
      for (var a = 0; a < nodos.length; a++) {
        var na = nodos[a];
        for (var b = a + 1; b < nodos.length; b++) {
          var nb = nodos[b];
          var dx = na.ax - nb.ax, dy = na.ay - nb.ay, d = dx * dx + dy * dy;
          if (d > r2) continue;
          var f = 1 - d / r2;
          var vivo = Math.max(na.pulso, nb.pulso);
          ctx.strokeStyle = 'rgba(' + (vivo > 0 ? acento : tinta) + ',' +
            (f * (vivo > 0 ? 0.5 + vivo * 0.3 : 0.2)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(na.ax, na.ay);
          ctx.lineTo(nb.ax, nb.ay);
          ctx.stroke();
        }
      }

      // El recorrido va encima del tejido y debajo de los puntos: es la lectura
      // del dibujo, no una linea mas del fondo.
      pintaVuelta(ahora);

      // enlaces al puntero
      if (px > -9000) {
        var p2 = radioPuntero * radioPuntero;
        for (var c = 0; c < nodos.length; c++) {
          var nc = nodos[c];
          var ex = nc.ax - px, ey = nc.ay - py, e2 = ex * ex + ey * ey;
          if (e2 > p2) continue;
          ctx.strokeStyle = 'rgba(' + acento + ',' + ((1 - e2 / p2) * 0.4).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nc.ax, nc.ay);
          ctx.stroke();
        }
      }

      // nodos. El 01 no se dibuja aqui: su punto esta en el HTML y siempre esta
      // puesto. El anillo del latido si, y ese sale para cualquier nodo.
      for (var k = 0; k < nodos.length; k++) {
        var nn = nodos[k];
        var pu = nn.pulso > 0 ? nn.pulso : 0;
        if (pu > 0 && nn.fijo) {
          ctx.beginPath();
          ctx.arc(nn.ax, nn.ay, 9 + (1 - pu) * 20, 0, 6.2832);
          ctx.strokeStyle = 'rgba(' + acento + ',' + (pu * 0.55).toFixed(3) + ')';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        if (nn.r <= 0) continue;
        ctx.beginPath();
        ctx.arc(nn.ax, nn.ay, nn.r + pu * 2.8, 0, 6.2832);
        ctx.fillStyle = pu > 0
          ? 'rgba(' + acento + ',' + (0.55 + pu * 0.45).toFixed(3) + ')'
          : 'rgba(' + tinta + ',0.56)';
        ctx.fill();
      }

      rafId = quieto ? 0 : requestAnimationFrame(cuadro);
    }

    function arranca() { if (!rafId && !quieto && dentro && !document.hidden) rafId = requestAnimationFrame(cuadro); }
    // Al parar se tira la vuelta en vuelo: si no, al volver habrian pasado los
    // segundos de golpe y el mensaje aparecia ya en la meta.
    function para() { tira(); if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

    medir();
    cuadro();

    addEventListener('resize', function () { medir(); if (quieto) cuadro(); }, { passive: true });
    addEventListener('pointermove', function (e) {
      var c = canvas.getBoundingClientRect();
      px = e.clientX - c.left; py = e.clientY - c.top;
    }, { passive: true });
    addEventListener('pointerleave', function () { px = py = -9999; }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) para(); else arranca();
    });

    // Fuera de pantalla no se gasta un solo cuadro.
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (ent) {
        dentro = ent[0].isIntersecting;
        if (dentro) arranca(); else para();
      }, { rootMargin: '80px' }).observe(canvas);
    }

    return {
      pulse: pulse, mensaje: mensaje, setAnclas: setAnclas,
      vuelta: vuelta, duraVuelta: VUELTA, llega03: LLEGA,
      para: para, arranca: arranca, medir: medir,
      nodos: nodos, paradas: function () { return paradas; },
      ultima: function () { return ultima; },
      cuadros: function () { return t; }
    };
  }

  global.redDeNodos = redDeNodos;
})(window);
