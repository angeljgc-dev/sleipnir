/* El cierre: los nodos dispersos se juntan hasta formar Mexico y ahi empiezan
   a hablar entre ellos.

   Tres actos atados al scroll, en este orden:
     1. pocos puntos, grandes y muy separados, casi sin lineas;
     2. aparecen los demas, encogen y viajan a su sitio dentro del pais;
     3. ya formado, los puntos de dentro se mandan mensajes: el enlace se
        enciende en ambar, cruza un punto y se apaga.

   El contorno no se dibuja de memoria ni a mano: llega como la "d" del SVG que
   ya esta escrito en el HTML, sacada de Natural Earth. Asi el dato existe una
   sola vez y sirve igual para el mapa quieto (sin JavaScript) y para este.

   Lo caro de una red de puntos son los enlaces por cercania, que son O(n2) y
   aqui hay mas nodos que en la portada. Por eso el grafo se calcula una sola
   vez, sobre las posiciones finales, con una rejilla espacial y un tope de seis
   vecinos por nodo; cada cuadro solo recorre esa lista. Y las lineas se pintan
   agrupadas por opacidad, cuatro trazos por cuadro en vez de uno por enlace.

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
    var rafId = 0, dentro = true, T = 0, ultimoAlta = 0;
    var esc = 1, ox = 0, oy = 0, paso = 20, radioEnlace = 30;
    var TOPE_VECINOS = 6;
    var REZAGO = 0.28;      // cuanto se escalona la llegada entre el primer nodo y el ultimo

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

    // Rejilla de panal con temblor, no azar puro: el azar deja grumos y huecos,
    // y con huecos la peninsula de Baja California deja de leerse. Lo que se
    // quiere es un pais lleno, no un trazo.
    function siembra() {
      var cuantos = o.nodos || (an >= 1200 ? 245 : an >= 900 ? 220 : an >= 600 ? 190 : 160);
      var s = Math.sqrt(areaU / cuantos * 1.1547);   // 2/raiz(3): empaque hexagonal
      var filas = Math.ceil(alU / (s * 0.866)) + 1;
      var previos = nodos;
      nodos = [];
      for (var f = 0; f < filas; f++) {
        var y = f * s * 0.866;
        var corre = (f & 1) ? s / 2 : 0;
        for (var x = corre; x < anU; x += s) {
          var jx = x + (Math.random() - 0.5) * s * 0.5;
          var jy = y + (Math.random() - 0.5) * s * 0.5;
          if (!dentroDelPais(jx, jy)) continue;
          var v = previos[nodos.length];
          nodos.push({
            mx: ox + jx * esc, my: oy + jy * esc,
            x: 0, y: 0,
            // de donde viene: muy lejos y muy repartido, hasta fuera del lienzo
            dx: v ? v.dx : (-0.18 + Math.random() * 1.36) * an,
            dy: v ? v.dy : (-0.14 + Math.random() * 1.28) * al,
            vx: v ? v.vx : (Math.random() - 0.5) * 0.34,
            vy: v ? v.vy : (Math.random() - 0.5) * 0.34,
            // el primer acto son pocos puntos: el resto entra al agruparse
            pronto: v ? v.pronto : Math.random() < 0.34,
            atraso: v ? v.atraso : Math.random() * REZAGO,
            rg: 4.6 + Math.random() * 4.2,
            rc: 1.05 + Math.random() * 1.25,
            fase: Math.random() * 6.2832,
            pulso: 0, t: 0, a: 0
          });
        }
      }
      paso = s * esc;
      radioEnlace = paso * 1.62;
      teje();
    }

    // El grafo se calcula una vez, sobre las posiciones finales. Rejilla
    // espacial de celda igual al radio: cada nodo mira nueve celdas y se queda
    // con sus seis vecinos mas cercanos. De aqui en adelante ningun cuadro
    // vuelve a comparar nodo contra nodo.
    function teje() {
      enlaces = [];
      if (!nodos.length) { tandas = []; return; }
      var c = Math.max(8, radioEnlace);
      var cols = Math.ceil(anU * esc / c) + 2;
      var cubos = {};
      var i, j;
      for (i = 0; i < nodos.length; i++) {
        var k = ((nodos[i].my - oy) / c | 0) * cols + ((nodos[i].mx - ox) / c | 0);
        (cubos[k] || (cubos[k] = [])).push(i);
      }
      var r2 = radioEnlace * radioEnlace;
      for (i = 0; i < nodos.length; i++) {
        var a = nodos[i];
        var cx = (a.mx - ox) / c | 0, cy = (a.my - oy) / c | 0;
        var cerca = [];
        for (var u = -1; u <= 1; u++) {
          for (var v = -1; v <= 1; v++) {
            var lista = cubos[(cy + v) * cols + (cx + u)];
            if (!lista) continue;
            for (var q = 0; q < lista.length; q++) {
              j = lista[q];
              if (j === i) continue;
              var ex = nodos[j].mx - a.mx, ey = nodos[j].my - a.my, e2 = ex * ex + ey * ey;
              if (e2 <= r2) cerca.push([e2, j]);
            }
          }
        }
        cerca.sort(function (p, q) { return p[0] - q[0]; });
        a.vec = [];
        for (var n = 0; n < cerca.length && n < TOPE_VECINOS; n++) {
          var otro = cerca[n][1];
          a.vec.push(otro);
          if (otro > i) enlaces.push([i, otro, 1 - cerca[n][0] / r2]);
        }
      }
      // Cuatro tandas por opacidad. Pintar enlace por enlace serian cientos de
      // trazos por cuadro; asi son cuatro.
      tandas = [[], [], [], []];
      for (i = 0; i < enlaces.length; i++) {
        var f = enlaces[i][2];
        tandas[Math.min(3, (f * 4) | 0)].push(enlaces[i]);
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
      if (esc > 0) siembra();
    }

    /* ---------------- el scroll manda los tres actos ---------------- */

    // 0 es disperso del todo, 1 es el pais hecho. Los primeros centimetros de
    // la seccion no forman nada a proposito: hay que ver el desorden antes.
    function progreso(p) {
      T = (p - 0.10) / 0.52;
      T = T < 0 ? 0 : T > 1 ? 1 : T;
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

    function cuadro(ahora) {
      rafId = quieto ? 0 : requestAnimationFrame(cuadro);
      if (!an || !al || esc <= 0) return;
      ahora = ahora || performance.now();
      ctx.clearRect(0, 0, an, al);

      var hecho = 1, i, n;
      for (i = 0; i < nodos.length; i++) {
        n = nodos[i];
        var t = (T - n.atraso) / (1 - REZAGO);
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        n.t = t;
        if (t < 1) hecho = 0;
        var e = suave(t);

        if (t < 1) {
          // mientras andan sueltos siguen vagando: un punto quieto en el primer
          // acto parece un error, no una particula
          n.dx += n.vx; n.dy += n.vy;
          if (n.dx < -0.2 * an || n.dx > 1.2 * an) n.vx = -n.vx;
          if (n.dy < -0.2 * al || n.dy > 1.2 * al) n.vy = -n.vy;
        }
        // ya colocado respira un poco, para que el pais no quede de carton
        var resp = e === 1 ? Math.sin(ahora * 0.0009 + n.fase) * 1.1 : 0;
        n.x = n.dx + (n.mx - n.dx) * e + resp;
        n.y = n.dy + (n.my - n.dy) * e + resp * 0.7;
        n.r = n.rg + (n.rc - n.rg) * e;
        n.a = n.pronto ? 1 : Math.min(1, T * 3.2);
        if (n.pulso > 0) n.pulso -= 0.016;
      }

      // Enlaces. Dos reglas, las dos a proposito: en el primer acto no hay
      // ninguno, y despues cada uno solo aparece cuando sus dos extremos ya
      // llegaron a su sitio. Asi el pais no se dibuja de golpe: se va cosiendo
      // por zonas conforme los puntos se acomodan, que es lo que hay que ver.
      var velo = (T - 0.46) / 0.3;
      velo = velo < 0 ? 0 : velo > 1 ? 1 : velo;
      if (velo > 0) {
        ctx.lineWidth = 1;
        for (var b = 0; b < tandas.length; b++) {
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
      if (hecho && T >= 1) {
        if (ahora - ultimoAlta > 150) { ultimoAlta = ahora; habla(ahora); }
      }
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
      // por punto.
      var cubo = [[], [], [], []];
      for (i = 0; i < nodos.length; i++) {
        n = nodos[i];
        if (n.a <= 0.01) continue;
        if (n.pulso > 0) continue;
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

      // Los que acaban de hablar, encendidos.
      for (i = 0; i < nodos.length; i++) {
        n = nodos[i];
        if (n.pulso <= 0) continue;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + n.pulso * 1.9, 0, 6.2832);
        ctx.fillStyle = 'rgba(' + acento + ',' + (0.45 + n.pulso * 0.55).toFixed(3) + ')';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 + (1 - n.pulso) * 11, 0, 6.2832);
        ctx.strokeStyle = 'rgba(' + acento + ',' + (n.pulso * 0.3).toFixed(3) + ')';
        ctx.stroke();
      }
    }

    function arranca() {
      if (!rafId && !quieto && dentro && !document.hidden) rafId = requestAnimationFrame(cuadro);
    }
    function para() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

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
    } else { arranca(); }

    return {
      progreso: progreso, medir: medir, para: para, arranca: arranca,
      nodos: function () { return nodos; },
      enlaces: function () { return enlaces.length; }
    };
  }

  global.mapaDeMexico = mapaDeMexico;
})(window);
