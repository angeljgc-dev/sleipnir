/* El cierre: los nodos dispersos se juntan hasta formar Mexico y ahi empiezan
   a hablar entre ellos.

   Tres actos, en este orden:
     1. pocos puntos, grandes y muy separados, casi sin lineas;
     2. aparecen los demas, encogen y viajan a su sitio dentro del pais;
     3. ya formado, los puntos de dentro se mandan mensajes: el enlace se
        enciende en ambar, cruza un punto y se apaga.

   Los tres corren por reloj, no por scroll, y el reloj arranca cuando la
   seccion entra en pantalla. Atados al scroll pedian un tramo fijado de
   260svh, y ese tramo hacia dano por partida triple: quien llegaba veia puntos
   sueltos junto a un panel con su titulo y su boton, daba la pagina por
   terminada y no bajaba el resto, asi que el remate no lo veia casi nadie; la
   pagina media pantalla y media de mas; y los tramos del scroll se miden
   contra innerHeight mientras los altos van en svh, de modo que la barra de
   direcciones de un Android desajustaba la cuenta y el pais se quedaba a medio
   formar. Por reloj no pasa ninguna de las tres.

   El reloj solo avanza mientras el lienzo esta en pantalla y la pestana
   visible, y no se reinicia nunca: quien sube y vuelve a bajar lo encuentra
   donde lo dejo.

   El contorno no se dibuja de memoria ni a mano: llega como la "d" del SVG que
   ya esta escrito en el HTML, sacada de Natural Earth. Asi el dato existe una
   sola vez y sirve igual para el mapa quieto (sin JavaScript) y para este.

   Tres decisiones que no son de gusto:

   - El reparto es **siempre el mismo**. El azar lleva semilla fija y el sorteo
     se hace en las coordenadas del mapa, no en pixeles, asi que un cambio de
     alto de la ventana no lo vuelve a tirar. En un telefono eso importa mucho:
     la barra de direcciones de Chrome se esconde y reaparece al subir y bajar,
     y con azar suelto el pais salia distinto cada vez.
   - Los puntos no solo van por dentro: hay una vuelta completa **por el
     perimetro**, a paso regular. Sin ella el borde queda deshilachado y las
     partes delgadas, la peninsula de Baja California sobre todo, se pierden.
   - El grafo acaba en **una sola pieza**. Despues de enlazar por cercania se
     cosen las partes sueltas por su par de nodos mas cercano, que es lo que
     cruza el Golfo de California. Ademas de verse mejor dice lo correcto: la
     red de Sleipnir es una sola red, no islas.

   Lo caro de una red de puntos son los enlaces por cercania, que son O(n2). Por
   eso el grafo se calcula una sola vez, con una rejilla espacial y un tope de
   seis vecinos por nodo; cada cuadro solo recorre esa lista. Y las lineas se
   pintan agrupadas por opacidad, cuatro trazos por cuadro en vez de uno por
   enlace.

   Va como script clasico, igual que red.js: la pagina se abre con doble clic y
   los modulos ES no cargan desde file://. */
(function (global) {

  // "M0 7L79 0L76 7..." a pares de numeros. No hay curvas ni mas comandos: el
  // contorno se simplifico a puro segmento recto a proposito.
  function rutaAPuntos(d) {
    var trozos = String(d).replace(/^\s*M/, '').replace(/Z\s*$/i, '').split('L');
    var pts = [];
    for (var i = 0; i < trozos.length; i++) {
      var n = trozos[i].trim().split(/[\s,]+/);
      if (n.length >= 2) pts.push([+n[0], +n[1]]);
    }
    return pts;
  }

  // Azar con semilla, para que el mismo lienzo de siempre el mismo pais.
  function azar(semilla) {
    var a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function mapaDeMexico(canvas, opciones) {
    var o = opciones || {};
    var ctx = canvas.getContext('2d', { alpha: true });
    var quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tinta = o.tinta || '236,234,228';
    var acento = o.acento || '255,179,87';

    var forma = rutaAPuntos(o.contorno);
    if (forma.length < 3) return null;

    var anU = 0, alU = 0, areaU = 0;
    (function () {
      var x1 = -1e9, y1 = -1e9, s = 0;
      for (var i = 0; i < forma.length; i++) {
        if (forma[i][0] > x1) x1 = forma[i][0];
        if (forma[i][1] > y1) y1 = forma[i][1];
        var q = forma[(i + 1) % forma.length];
        s += forma[i][0] * q[1] - q[0] * forma[i][1];
      }
      anU = x1; alU = y1; areaU = Math.abs(s / 2);
    })();

    var dpr = 1, an = 0, al = 0;
    var nodos = [], enlaces = [], tandas = [], mensajes = [];
    var rafId = 0, dentro = true, T = 0, ultimoAlta = 0, tics = 0;
    var avance = 0, corriendo = false, anterior = 0;
    var esc = 1, ox = 0, oy = 0;
    var sembrados = 0, radioU = 30, piezas = [0, 0];
    var base = null, baseOk = false, baseX = 0, baseY = 0, baseAn = 0, baseAl = 0;
    var SEMILLA = 20261013;
    var TOPE_VECINOS = 6;
    var REZAGO = 0.28;      // cuanto se escalona la llegada entre el primer nodo y el ultimo
    var ESPERA = 700;       // lo que se ve el desorden antes de que empiece a juntarse
    var FORMA = 5700;       // lo que tarda el pais en quedar hecho
    var SALTO = 60;         // tope por cuadro, para que un paron no adelante el reloj

    /* ---------------- donde cabe el pais ---------------- */

    // El sitio del pais lo manda el CSS, no este archivo: la caja es la de la
    // figura quieta del HTML, que sigue reservando su hueco aunque este
    // invisible. Si el mapa estorbara al texto, el que se mueve es el mapa, y
    // se mueve cambiando la hoja de estilos.
    function encaja() {
      var m = an >= 900 ? 40 : 18;
      var x = m, y = m, w = an - m * 2, h = al - m * 2;
      var p = o.region ? o.region() : null;
      if (p) { x = p.x; y = p.y; w = p.w; h = p.h; }
      if (w < 40 || h < 40) { esc = 0; return; }
      esc = Math.min(w / anU, h / alU);
      ox = x + (w - anU * esc) / 2;
      oy = y + (h - alU * esc) / 2;
    }

    function dentroDelPais(x, y) {
      var s = false;
      for (var i = 0, j = forma.length - 1; i < forma.length; j = i++) {
        var xi = forma[i][0], yi = forma[i][1], xj = forma[j][0], yj = forma[j][1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s;
      }
      return s;
    }

    /* ---------------- los negocios, repartidos dentro ---------------- */

    // Todo el sorteo ocurre en las coordenadas del mapa (0 a 1000 de ancho), no
    // en pixeles, y con semilla fija: el pais sale identico siempre, y cambiar
    // el alto de la ventana no lo vuelve a tirar.
    //
    // Dos pasadas. Primero el perimetro a paso regular, que es lo que hace que
    // la silueta se lea con filo; luego el interior en rejilla de panal con
    // temblor, saltando lo que caiga pegado al borde para que no se amontone.
    // Rejilla de panal y no azar puro porque el azar deja grumos y huecos, y un
    // hueco en Baja California se come la peninsula entera.
    function siembra(cuantos) {
      var r = azar(SEMILLA);
      var s = Math.sqrt(areaU / (cuantos * 0.72) * 1.1547);  // 2/raiz(3): empaque hexagonal
      var sp = s * 0.60;                                     // paso del borde, mas apretado
      var i;
      nodos = [];

      // Los del borde van metidos un poco hacia dentro, no clavados en la
      // linea: asi ningun punto queda medio fuera del pais y, sobre todo, el
      // tramo entre dos vecinos del borde cae dentro, que es lo que luego
      // decide si se pueden enlazar.
      var adentro = sp * 0.26;
      var borde = [];
      var sobra = 0;
      for (i = 0; i < forma.length; i++) {
        var a = forma[i], b = forma[(i + 1) % forma.length];
        var dx = b[0] - a[0], dy = b[1] - a[1];
        var L = Math.sqrt(dx * dx + dy * dy);
        if (!L) continue;
        var nx = dy / L, ny = -dx / L;
        if (!dentroDelPais(a[0] + dx / 2 + nx, a[1] + dy / 2 + ny)) { nx = -nx; ny = -ny; }
        for (var d = sobra; d < L; d += sp) {
          borde.push([a[0] + dx * d / L + nx * adentro, a[1] + dy * d / L + ny * adentro]);
        }
        sobra = ((L - sobra) % sp);
        sobra = sobra ? sp - sobra : 0;
      }
      for (i = 0; i < borde.length; i++) nodos.push(nuevo(borde[i][0], borde[i][1], r));

      var lejos = sp * 0.62, lejos2 = lejos * lejos;
      function pegadoAlBorde(x, y) {
        for (var k = 0; k < borde.length; k++) {
          var ex = borde[k][0] - x; if (ex > lejos || ex < -lejos) continue;
          var ey = borde[k][1] - y; if (ey > lejos || ey < -lejos) continue;
          if (ex * ex + ey * ey < lejos2) return true;
        }
        return false;
      }

      var filas = Math.ceil(alU / (s * 0.866)) + 1;
      for (var f = 0; f < filas; f++) {
        var y = f * s * 0.866;
        var corre = (f & 1) ? s / 2 : 0;
        for (var x = corre; x < anU; x += s) {
          var jx = x + (r() - 0.5) * s * 0.5;
          var jy = y + (r() - 0.5) * s * 0.5;
          if (!dentroDelPais(jx, jy) || pegadoAlBorde(jx, jy)) continue;
          nodos.push(nuevo(jx, jy, r));
        }
      }

      radioU = s * 1.62;
      teje();
    }

    // De donde sale cada nodo y como llega. La dispersion va en fracciones del
    // lienzo, no en pixeles, por la misma razon que el sorteo: para que no
    // dependa del alto que tenga la ventana en ese momento.
    function nuevo(ux, uy, r) {
      return {
        ux: ux, uy: uy, mx: 0, my: 0, x: 0, y: 0,
        fx: -0.18 + r() * 1.36, fy: -0.14 + r() * 1.28,
        vfx: (r() - 0.5) * 0.0006, vfy: (r() - 0.5) * 0.0006,
        // el primer acto son pocos puntos: el resto entra al agruparse
        pronto: r() < 0.34,
        atraso: r() * REZAGO,
        rg: 4.6 + r() * 4.2,
        rc: 1.05 + r() * 1.25,
        pulso: 0, t: 0, a: 0, vec: null
      };
    }

    // Un enlace solo vale si va por tierra. Sin esta regla el Golfo de
    // California se cierra de lineas, Baja California deja de leerse como
    // peninsula y todas las bahias se rellenan: la silueta se pierde, que es
    // justo lo contrario de lo que hay que ver. Tres catas bastan porque el
    // radio de vecindad es corto comparado con lo que mide una entrada de mar.
    function porTierra(a, b) {
      var dx = b.ux - a.ux, dy = b.uy - a.uy;
      return dentroDelPais(a.ux + dx * 0.3, a.uy + dy * 0.3)
        && dentroDelPais(a.ux + dx * 0.5, a.uy + dy * 0.5)
        && dentroDelPais(a.ux + dx * 0.7, a.uy + dy * 0.7);
    }

    // El grafo se calcula una vez, en coordenadas del mapa. Rejilla espacial de
    // celda igual al radio: cada nodo mira nueve celdas y se queda con sus seis
    // vecinos mas cercanos. De aqui en adelante ningun cuadro vuelve a comparar
    // nodo contra nodo.
    function teje() {
      enlaces = [];
      if (!nodos.length) { tandas = []; piezas = [0, 0]; return; }
      var c = Math.max(1, radioU);
      var cols = Math.ceil(anU / c) + 2;
      var cubos = {};
      var i, j;
      for (i = 0; i < nodos.length; i++) {
        var k = (nodos[i].uy / c | 0) * cols + (nodos[i].ux / c | 0);
        (cubos[k] || (cubos[k] = [])).push(i);
      }
      var r2 = radioU * radioU;
      for (i = 0; i < nodos.length; i++) {
        var a = nodos[i];
        var cx = a.ux / c | 0, cy = a.uy / c | 0;
        var cerca = [];
        for (var u = -1; u <= 1; u++) {
          for (var v = -1; v <= 1; v++) {
            var lista = cubos[(cy + v) * cols + (cx + u)];
            if (!lista) continue;
            for (var q = 0; q < lista.length; q++) {
              j = lista[q];
              if (j === i) continue;
              var ex = nodos[j].ux - a.ux, ey = nodos[j].uy - a.uy, e2 = ex * ex + ey * ey;
              if (e2 <= r2) cerca.push([e2, j]);
            }
          }
        }
        cerca.sort(function (p, q) { return p[0] - q[0]; });
        a.vec = [];
        for (var n = 0; n < cerca.length && a.vec.length < TOPE_VECINOS; n++) {
          var otro = cerca[n][1];
          if (!porTierra(a, nodos[otro])) continue;
          a.vec.push(otro);
          if (otro > i) enlaces.push([i, otro, 1 - cerca[n][0] / r2]);
        }
      }
      cose();
      // Cuatro tandas por opacidad. Pintar enlace por enlace serian cientos de
      // trazos por cuadro; asi son cuatro.
      tandas = [[], [], [], []];
      for (i = 0; i < enlaces.length; i++) {
        var fu = enlaces[i][2];
        tandas[Math.min(3, (fu * 4) | 0)].push(enlaces[i]);
      }
    }

    // Enlazar por cercania deja piezas sueltas: el Golfo de California es mas
    // ancho que el radio de vecindad, asi que Baja California se queda sola. Se
    // cosen de dos en dos por su par de nodos mas cercano hasta que no queda
    // mas que una pieza. Son uno o dos enlaces largos, y son los correctos: la
    // red de Sleipnir es una sola red.
    function cose() {
      var padre = [], i, j;
      for (i = 0; i < nodos.length; i++) padre.push(i);
      function raiz(k) { while (padre[k] !== k) { padre[k] = padre[padre[k]]; k = padre[k]; } return k; }
      function junta(x, y) { x = raiz(x); y = raiz(y); if (x === y) return false; padre[y] = x; return true; }

      for (i = 0; i < enlaces.length; i++) junta(enlaces[i][0], enlaces[i][1]);
      var sueltas = 0;
      for (i = 0; i < nodos.length; i++) if (raiz(i) === i) sueltas++;
      var antes = sueltas;

      while (sueltas > 1) {
        var mejor = null, min = Infinity;
        for (i = 0; i < nodos.length; i++) {
          var ri = raiz(i);
          for (j = i + 1; j < nodos.length; j++) {
            if (raiz(j) === ri) continue;
            var dx = nodos[j].ux - nodos[i].ux, dy = nodos[j].uy - nodos[i].uy;
            var d2 = dx * dx + dy * dy;
            if (d2 < min) { min = d2; mejor = [i, j]; }
          }
        }
        if (!mejor) break;
        junta(mejor[0], mejor[1]);
        // fuerza media a proposito: el enlace largo tiene que verse, pero no
        // puede gritar mas que el resto de la red
        enlaces.push([mejor[0], mejor[1], 0.5]);
        nodos[mejor[0]].vec.push(mejor[1]);
        nodos[mejor[1]].vec.push(mejor[0]);
        sueltas--;
      }
      piezas = [antes, sueltas];
    }

    // Colocar no es sembrar: esto solo lleva las coordenadas del mapa a pixeles.
    // Es lo unico que corre cuando cambia el tamano de la ventana.
    function coloca() {
      for (var i = 0; i < nodos.length; i++) {
        nodos[i].mx = ox + nodos[i].ux * esc;
        nodos[i].my = oy + nodos[i].uy * esc;
      }
    }

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      an = canvas.clientWidth; al = canvas.clientHeight;
      if (!an || !al) return;
      canvas.width = Math.round(an * dpr);
      canvas.height = Math.round(al * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      encaja();
      baseOk = false;
      if (esc <= 0) return;
      // Cuantos nodos solo depende del ancho. Si no cambia, no se vuelve a
      // sembrar: en un telefono la barra de direcciones cambia el alto cada vez
      // que el visitante sube y baja, y rehacer el reparto ahi le cambiaba el
      // pais a cada rato.
      var cuantos = o.nodos || (an >= 1200 ? 250 : an >= 900 ? 225 : an >= 600 ? 195 : 165);
      if (cuantos !== sembrados) { sembrados = cuantos; siembra(cuantos); }
      coloca();
    }

    /* ---------------- el reloj manda los tres actos ---------------- */

    // 0 es disperso del todo, 1 es el pais hecho. Los primeros 0.7 s no forman
    // nada a proposito: hay que ver el desorden antes.
    //
    // El reloj se suma cuadro a cuadro y no se saca restando dos marcas de
    // tiempo: entre una y otra el lienzo puede haber estado fuera de pantalla o
    // la pestana en segundo plano, y ahi no se pinta, asi que con la resta el
    // que se va y vuelve se encontraria el pais adelantado de golpe. El tope
    // por cuadro hace lo mismo con un paron del hilo principal.
    function reloj(ahora) {
      if (!corriendo || T >= 1) { anterior = ahora; return; }
      var paso = ahora - anterior;
      anterior = ahora;
      if (paso > 0) avance += paso > SALTO ? SALTO : paso;
      T = (avance - ESPERA) / FORMA;
      T = T < 0 ? 0 : T > 1 ? 1 : T;
    }

    // Se llama cuando la seccion entra en pantalla, y solo la primera vez: el
    // que sube y vuelve a bajar no tiene que verlo empezar de nuevo.
    function empieza() {
      if (corriendo) return;
      corriendo = true;
      anterior = performance.now();
      arranca();
    }

    function suave(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

    /* ---------------- los mensajes ---------------- */

    function habla(ahora) {
      var tope = an >= 900 ? 14 : 9;
      if (mensajes.length >= tope || nodos.length < 2) return;
      var a = (Math.random() * nodos.length) | 0;
      var na = nodos[a];
      if (!na.vec || !na.vec.length) return;
      var b = na.vec[(Math.random() * na.vec.length) | 0];
      mensajes.push({ a: a, b: b, t0: ahora, dur: 900 + Math.random() * 900 });
      na.pulso = 1;
    }

    /* ---------------- el cuadro ---------------- */

    // Una vez formado, el pais se queda quieto: ni un nodo ni una linea cambian
    // de sitio. Entonces no tiene sentido volver a trazar ochocientos segmentos
    // sesenta veces por segundo. Se pinta una vez en un lienzo aparte, del
    // tamano del mapa y no de la pantalla, y de ahi en adelante cada cuadro es
    // una estampa mas los mensajes en ambar, que son lo unico vivo.
    function pintaBase() {
      var m = 8, i, b;
      baseX = ox - m; baseY = oy - m;
      baseAn = Math.ceil(anU * esc + m * 2); baseAl = Math.ceil(alU * esc + m * 2);
      if (!base) base = document.createElement('canvas');
      base.width = Math.round(baseAn * dpr);
      base.height = Math.round(baseAl * dpr);
      var g = base.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, baseAn, baseAl);

      g.lineWidth = 1;
      for (b = 0; b < tandas.length; b++) {
        if (!tandas[b].length) continue;
        g.beginPath();
        for (i = 0; i < tandas[b].length; i++) {
          var na = nodos[tandas[b][i][0]], nb = nodos[tandas[b][i][1]];
          g.moveTo(na.mx - baseX, na.my - baseY);
          g.lineTo(nb.mx - baseX, nb.my - baseY);
        }
        g.strokeStyle = 'rgba(' + tinta + ',' + (0.07 + b * 0.055).toFixed(3) + ')';
        g.stroke();
      }
      g.beginPath();
      for (i = 0; i < nodos.length; i++) {
        var p = nodos[i];
        g.moveTo(p.mx - baseX + p.rc, p.my - baseY);
        g.arc(p.mx - baseX, p.my - baseY, p.rc, 0, 6.2832);
      }
      g.fillStyle = 'rgba(' + tinta + ',0.59)';
      g.fill();
      baseOk = true;
    }

    function cuadro(ahora) {
      rafId = quieto ? 0 : requestAnimationFrame(cuadro);
      tics++;
      if (!an || !al || esc <= 0) return;
      ahora = ahora || performance.now();
      reloj(ahora);
      ctx.clearRect(0, 0, an, al);

      // Con T en 1 ya llegaron todos, por definicion: el mas rezagado sale a
      // REZAGO y el reparto esta hecho para que ninguno quede corto.
      var hecho = T >= 1, i, n, b;

      if (hecho) {
        // Los nodos se quedan clavados en su sitio. Hay que dejarlos escritos
        // igual, aunque no se dibujen uno por uno: de ahi salen los extremos de
        // los mensajes en ambar, que si se pintan.
        for (i = 0; i < nodos.length; i++) {
          n = nodos[i];
          n.x = n.mx; n.y = n.my; n.r = n.rc; n.t = 1; n.a = 1;
          if (n.pulso > 0) n.pulso -= 0.016;
        }
        if (!baseOk) pintaBase();
        ctx.drawImage(base, baseX, baseY, baseAn, baseAl);
      }

      for (i = 0; !hecho && i < nodos.length; i++) {
        n = nodos[i];
        var t = (T - n.atraso) / (1 - REZAGO);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        n.t = t;
        var e = suave(t);

        if (t < 1) {
          // mientras andan sueltos siguen vagando: un punto quieto en el primer
          // acto parece un error, no una particula. Va en fracciones del lienzo
          // para que el vagabundeo no cambie de escala con la ventana.
          n.fx += n.vfx; n.fy += n.vfy;
          if (n.fx < -0.2 || n.fx > 1.2) n.vfx = -n.vfx;
          if (n.fy < -0.2 || n.fy > 1.2) n.vfy = -n.vfy;
        }
        // Ya colocado no respira: el pais se queda quieto y clavado. Lo que se
        // mueve ahi son los mensajes, que para eso estan.
        var dx = n.fx * an, dy = n.fy * al;
        n.x = dx + (n.mx - dx) * e;
        n.y = dy + (n.my - dy) * e;
        n.r = n.rg + (n.rc - n.rg) * e;
        n.a = n.pronto ? 1 : Math.min(1, T * 3.2);
        if (n.pulso > 0) n.pulso -= 0.016;
      }

      // Enlaces. Dos reglas, las dos a proposito: en el primer acto no hay
      // ninguno, y despues cada uno solo aparece cuando sus dos extremos ya
      // llegaron a su sitio. Asi el pais no se dibuja de golpe: se va cosiendo
      // por zonas conforme los puntos se acomodan, que es lo que hay que ver.
      var velo = hecho ? 0 : (T - 0.46) / 0.3;
      velo = velo < 0 ? 0 : velo > 1 ? 1 : velo;
      if (velo > 0) {
        ctx.lineWidth = 1;
        for (b = 0; b < tandas.length; b++) {
          var tanda = tandas[b];
          if (!tanda.length) continue;
          ctx.beginPath();
          for (i = 0; i < tanda.length; i++) {
            var na = nodos[tanda[i][0]], nb = nodos[tanda[i][1]];
            if (!na || !nb || na.t < 0.82 || nb.t < 0.82) continue;
            ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
          }
          ctx.strokeStyle = 'rgba(' + tinta + ',' + ((0.07 + b * 0.055) * velo).toFixed(3) + ')';
          ctx.stroke();
        }
      }

      // Los mensajes: el enlace se enciende, un punto lo cruza y se apaga.
      if (hecho && ahora - ultimoAlta > 150) { ultimoAlta = ahora; habla(ahora); }
      for (i = mensajes.length - 1; i >= 0; i--) {
        var m = mensajes[i];
        var edad = (ahora - m.t0) / m.dur;
        if (edad >= 1 || !hecho) {
          if (edad >= 1 && nodos[m.b]) nodos[m.b].pulso = 1;
          mensajes.splice(i, 1);
          continue;
        }
        var sa = nodos[m.a], sb = nodos[m.b];
        if (!sa || !sb) { mensajes.splice(i, 1); continue; }
        var env = Math.sin(Math.PI * edad);
        ctx.strokeStyle = 'rgba(' + acento + ',' + (env * 0.62).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        var vx = sa.x + (sb.x - sa.x) * edad, vy = sa.y + (sb.y - sa.y) * edad;
        ctx.beginPath();
        ctx.arc(vx, vy, 2.1, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + acento + ',' + (0.35 + env * 0.65).toFixed(3) + ')';
        ctx.fill();
      }
      ctx.lineWidth = 1;

      // Nodos, tambien agrupados por opacidad: cuatro rellenos en vez de uno
      // por punto. Con el pais ya hecho esto no corre: los nodos estan en la
      // estampa.
      if (!hecho) {
        var cubo = [[], [], [], []];
        for (i = 0; i < nodos.length; i++) {
          n = nodos[i];
          if (n.a <= 0.01 || n.pulso > 0) continue;
          cubo[Math.min(3, (n.a * 4 - 0.0001) | 0)].push(n);
        }
        for (b = 0; b < 4; b++) {
          if (!cubo[b].length) continue;
          ctx.beginPath();
          for (i = 0; i < cubo[b].length; i++) {
            n = cubo[b][i];
            ctx.moveTo(n.x + n.r, n.y);
            ctx.arc(n.x, n.y, n.r, 0, 6.2832);
          }
          ctx.fillStyle = 'rgba(' + tinta + ',' + (0.2 + b * 0.13).toFixed(2) + ')';
          ctx.fill();
        }
      }

      // Los que acaban de hablar, encendidos.
      for (i = 0; i < nodos.length; i++) {
        n = nodos[i];
        if (n.pulso <= 0) continue;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.pulso * 1.9, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + acento + ',' + n.pulso.toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 + (1 - n.pulso) * 11, 0, 6.2832);
        ctx.strokeStyle = 'rgba(' + acento + ',' + (n.pulso * 0.3).toFixed(3) + ')';
        ctx.stroke();
      }
    }

    function arranca() {
      if (rafId || quieto || !dentro || document.hidden) return;
      // El rato que estuvo parado no cuenta: el reloj sigue donde lo dejo.
      anterior = performance.now();
      rafId = requestAnimationFrame(cuadro);
    }
    function para() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

    // Con movimiento reducido no hay formacion que ver: el pais sale hecho en el
    // unico cuadro que se pinta y no se pide ni uno mas. En la practica aqui no
    // se llega, porque sin la marca data-js el CSS esconde este lienzo y deja
    // el mapa quieto del HTML; va igual, para que el archivo se valga solo.
    if (quieto) { avance = ESPERA + FORMA; T = 1; }

    medir();
    cuadro(performance.now());

    addEventListener('resize', function () { medir(); if (quieto) cuadro(performance.now()); }, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) para(); else arranca();
    });
    // Fuera de pantalla no se gasta un solo cuadro.
    if (global.IntersectionObserver) {
      new IntersectionObserver(function (ent) {
        dentro = ent[0].isIntersecting;
        if (dentro) arranca(); else para();
      }, { rootMargin: '80px' }).observe(canvas);
      // Y un segundo observador para el reloj. Pide mas que el otro, un tercio
      // de la seccion a la vista, porque la formacion tiene que empezar cuando
      // el visitante ya esta mirando el cierre y no cuando le asoma el filo de
      // arriba: si no, el primer acto se le pasa antes de llegar.
      new IntersectionObserver(function (ent) {
        if (ent[0].isIntersecting) empieza();
      }, { threshold: 0.34 }).observe(canvas);
    } else { arranca(); empieza(); }

    return {
      empieza: empieza, medir: medir, para: para, arranca: arranca,
      formado: function () { return T >= 1; },
      reloj: function () { return avance; },
      nodos: function () { return nodos; },
      cuadros: function () { return tics; },
      enlaces: function () { return enlaces.length; },
      piezas: function () { return piezas; }
    };
  }

  global.mapaDeMexico = mapaDeMexico;
})(window);
