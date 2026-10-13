/* Red de nodos: cada punto es un negocio, cada linea una conversacion.
   Tres nodos estan clavados debajo de las anclas numeradas del HTML, para que
   la red se lea como un diagrama y no como un tapiz.

   Entre esos tres va el recorrido: una curva ambar de 01 a 02 y otra de 02 a
   03, con un mensaje que las recorre. Un negocio lleva a una conversacion y una
   conversacion lleva a una cita; si eso no se ve, los rotulos son tres
   etiquetas sueltas. La ruta se queda puesta aunque no pase nada, que es lo que
   la deja legible para quien llega entre un recorrido y el siguiente.

   El mensaje avanza por longitud de arco, no por el parametro de la curva: con
   la t de la bezier la velocidad cambia donde la curva se cierra y se nota. El
   trazo se mueve con setLineDash y lineDashOffset, que ya trabajan en esas
   unidades; la tabla de arco solo hace falta para medir la curva y para poner
   la cabeza.

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

    // El recorrido entre los nodos rotulados.
    var VIAJE = 2300;        // de 01 a 03, en ms; la mitad para cada tramo
    var APAGA = 700;         // lo que tarda la ruta en volver a su brillo de reposo
    var COMBAS = [0.12, 0.2, 0.28, 0.38];   // cuanto se puede separar la curva de la cuerda
    var RUTA = 0.34;         // la ruta en reposo: por encima del tejido, lejos del mensaje
    var tramos = [], tapan = [], viaje = null, rastro = 0;

    function medir() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      an = canvas.clientWidth;
      al = canvas.clientHeight;
      if (!an || !al) return;
      canvas.width = Math.round(an * dpr);
      canvas.height = Math.round(al * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var cuantos = Math.max(18, Math.min(maxNodos, Math.round((an * al) / densidad)));
      cuantos += anclas.length;
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
    // cajas de los rotulos y de las chapas, que son opacas y van por encima: lo
    // que pase por detras de una de esas no se ve, y el recorrido las esquiva.
    function setAnclas(lista, cajas) {
      anclas = lista || [];
      tapan = cajas || [];
      medir();
    }

    function colocarAnclas() {
      for (var i = 0; i < nodos.length; i++) nodos[i].fijo = false;
      for (var j = 0; j < anclas.length && j < nodos.length; j++) {
        var n = nodos[j];
        n.x = n.ax = anclas[j][0]; n.y = n.ay = anclas[j][1];
        n.vx = n.vy = 0; n.fijo = true; n.r = 0;
      }
      trazaRuta();
    }

    /* ---------------- la ruta entre los nodos rotulados ---------------- */

    // Cada rotulo cuelga a la derecha de su punto, asi que una recta saldria
    // por debajo de la etiqueta del nodo del que arranca. La curva se comba
    // para salir de ahi, y hacia que lado no se decide a ojo: se prueban los
    // dos, de menos comba a mas, y se queda la primera que no pasa por detras
    // de ninguna chapa. En un telefono de 320 el lado bueno es el contrario que
    // en un escritorio, y asi no hay que escribir dos reglas.
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

    function oculto(cu) {
      var n = 0;
      for (var i = 0; i < cu.pts.length; i += 2) {
        var x = cu.pts[i], y = cu.pts[i + 1];
        for (var j = 0; j < tapan.length; j++) {
          var b = tapan[j];
          if (x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3]) { n++; break; }
        }
      }
      return n;
    }

    function mejorCurva(a, b) {
      var mejor = null;
      for (var c = 0; c < COMBAS.length; c++) {
        for (var l = 1; l >= -1; l -= 2) {
          var cu = curva(a, b, l, COMBAS[c]);
          if (!cu) return null;
          var m = oculto(cu);
          if (!m) return cu;
          if (!mejor || m < mejor.m) mejor = { m: m, cu: cu };
        }
      }
      return mejor && mejor.cu;
    }

    function trazaRuta() {
      tramos = [];
      if (anclas.length < 3) return;
      var uno = mejorCurva(anclas[0], anclas[1]);
      var dos = mejorCurva(anclas[1], anclas[2]);
      if (uno && dos) tramos = [uno, dos];
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

    // Un solo recorrido, no dos encadenados por reloj: el mensaje avanza por una
    // sola distancia y el salto al segundo tramo ocurre cuando esa distancia
    // pasa por 02. Frena al llegar al nodo y vuelve a tomar vuelo al salir, que
    // es lo que hace que se lea la causa antes que el efecto.
    function recorre(aviso) {
      if (quieto || tramos.length < 2 || !dentro || document.hidden) return 0;
      viaje = { t0: performance.now(), hito: -1, aviso: aviso || null };
      return VIAJE;
    }

    function paso(i) {
      mensaje(i);
      if (viaje && viaje.aviso) viaje.aviso(i);
    }

    function pintaRuta(ahora) {
      // Si un cambio de tamano deja la lamina sin sitio para las curvas, el
      // recorrido en vuelo se tira: no hay por donde seguirlo.
      if (!tramos.length) { viaje = null; rastro = 0; return; }
      var brillo = [RUTA, RUTA], cabeza = -1, s = 0;

      if (viaje) {
        var u = (ahora - viaje.t0) / VIAJE;
        if (viaje.hito < 0) { viaje.hito = 0; paso(0); }
        if (u >= 0.5 && viaje.hito < 1) { viaje.hito = 1; paso(1); }
        if (u >= 1) {
          viaje.hito = 2; paso(2);
          viaje = null; rastro = ahora;
        } else {
          cabeza = u < 0.5 ? 0 : 1;
          var w = u < 0.5 ? u * 2 : u * 2 - 1;
          // entrada frenando al 02; salida que arranca y vuelve a frenar al 03
          var e = cabeza === 0 ? 1 - (1 - w) * (1 - w) : w * w * (3 - 2 * w);
          s = e * tramos[cabeza].L;
          brillo[0] = 0.58;
          if (cabeza === 1) brillo[1] = 0.58;
        }
      }
      if (!viaje && rastro) {
        var q = 1 - (ahora - rastro) / APAGA;
        if (q <= 0) rastro = 0;
        else { brillo[0] = brillo[1] = RUTA + (0.58 - RUTA) * q; }
      }

      ctx.lineCap = 'round';
      for (var i = 0; i < tramos.length; i++) {
        ctx.lineWidth = brillo[i] > RUTA ? 1.7 : 1.5;
        ctx.strokeStyle = 'rgba(' + acento + ',' + brillo[i].toFixed(3) + ')';
        dibuja(tramos[i]); ctx.stroke();
      }

      if (cabeza < 0) { ctx.lineCap = 'butt'; ctx.lineWidth = 1; return; }

      // La cabeza son tres pasadas del mismo trazo, cada vez mas corta y mas
      // encendida. Un shadowBlur daria el mismo halo y obliga al navegador a
      // rasterizar aparte en cada cuadro.
      var cu = tramos[cabeza];
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

      var h = enArco(cu, s);
      ctx.beginPath(); ctx.arc(h[0], h[1], 4.6, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + acento + ',0.2)'; ctx.fill();
      ctx.beginPath(); ctx.arc(h[0], h[1], 2.2, 0, 6.2832);
      ctx.fillStyle = 'rgba(' + acento + ',1)'; ctx.fill();
      ctx.lineCap = 'butt';
      ctx.lineWidth = 1;
    }

    // Sin indice late un negocio cualquiera, nunca uno de los tres rotulados:
    // esos solo se encienden cuando pasa el mensaje.
    function pulse(i) {
      var k;
      if (i == null) {
        if (nodos.length <= anclas.length) return;
        k = anclas.length + ((Math.random() * (nodos.length - anclas.length)) | 0);
      } else k = i % nodos.length;
      var n = nodos[k];
      if (n) n.pulso = 1;
    }

    // Un mensaje no enciende un punto suelto: enciende el ancla y arrastra a sus
    // vecinos mas cercanos, que es lo que hace una conversacion al pasar.
    function mensaje(i) {
      var k = anclas.length ? (i == null ? (Math.random() * anclas.length) | 0 : i % anclas.length) : 0;
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
          var dx = na.ax - nb.ax, dy = na.ay - nb.ay, d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          var f = 1 - d2 / r2;
          var vivo = Math.max(na.pulso, nb.pulso);
          ctx.strokeStyle = 'rgba(' + (vivo > 0 ? acento : tinta) + ',' +
            (f * (vivo > 0 ? 0.5 + vivo * 0.3 : 0.2)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(na.ax, na.ay);
          ctx.lineTo(nb.ax, nb.ay);
          ctx.stroke();
        }
      }

      // La ruta va encima del tejido y debajo de los puntos: es la lectura del
      // dibujo, no una linea mas del fondo.
      pintaRuta(ahora);

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

      // nodos: los que vagan se pintan; las anclas ya tienen su punto en el DOM,
      // asi que de ellas solo se dibuja el anillo cuando laten.
      for (var k = 0; k < nodos.length; k++) {
        var nn = nodos[k];
        var pu = nn.pulso > 0 ? nn.pulso : 0;
        if (nn.fijo) {
          if (pu > 0) {
            ctx.beginPath();
            ctx.arc(nn.ax, nn.ay, 9 + (1 - pu) * 20, 0, 6.2832);
            ctx.strokeStyle = 'rgba(' + acento + ',' + (pu * 0.55).toFixed(3) + ')';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.lineWidth = 1;
          }
          continue;
        }
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
    // Al parar se tira el recorrido en vuelo: si no, al volver habrian pasado
    // los segundos de golpe y el mensaje aparecia ya en la meta.
    function para() { viaje = null; rastro = 0; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

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
      recorre: recorre, duraViaje: VIAJE,
      para: para, arranca: arranca, medir: medir,
      nodos: nodos, tramos: function () { return tramos; },
      cuadros: function () { return t; }
    };
  }

  global.redDeNodos = redDeNodos;
})(window);
