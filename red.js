/* Red de nodos: cada punto es un negocio, cada linea una conversacion.
   Tres nodos estan clavados debajo de las anclas numeradas del HTML, para que
   la red se lea como un diagrama y no como un tapiz: cuando entra un mensaje,
   late el nodo que tiene su rotulo al lado.

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
    var px = -9999, py = -9999, rafId = 0, t = 0, dentro = true, conv = 0;
    // hacia donde se cierra el nudo, en fracciones del lienzo
    var fx = o.foco ? o.foco[0] : 0.5, fy = o.foco ? o.foco[1] : 0.5;

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
    // manda sobre la posicion y el canvas solo la sigue.
    function setAnclas(lista) {
      anclas = lista || [];
      medir();
    }

    function colocarAnclas() {
      for (var i = 0; i < nodos.length; i++) nodos[i].fijo = false;
      for (var j = 0; j < anclas.length && j < nodos.length; j++) {
        var n = nodos[j];
        n.x = n.ax = anclas[j][0]; n.y = n.ay = anclas[j][1];
        n.vx = n.vy = 0; n.fijo = true; n.r = 0;
      }
    }

    function pulse(i) {
      var n = nodos[i == null ? (Math.random() * nodos.length) | 0 : i % nodos.length];
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

    // Los nodos se juntan hacia el centro. De 0 a 1. Sirve para el cierre: la
    // red que estuvo dispersa toda la pagina acaba cerrandose en un nudo.
    //
    // No se mueve el nodo: se pinta en otro sitio. Si se le empujara la
    // posicion, la atraccion se iria acumulando cuadro a cuadro y la red
    // acabaria colapsada en un punto del que ya no se puede volver. Asi el
    // apreton es exactamente el que dice el scroll, y se deshace al subir.
    function converger(v) { conv = v < 0 ? 0 : (v > 1 ? 1 : v); }
    function setFoco(a, b) { fx = a; fy = b; }

    function cuadro() {
      t++;
      ctx.clearRect(0, 0, an, al);

      var cx = an * fx, cy = al * fy;
      var k = conv * 0.66;
      for (var i = 0; i < nodos.length; i++) {
        var n = nodos[i];
        if (!n.fijo) {
          n.x += n.vx; n.y += n.vy;
          if (n.x < 0) { n.x = 0; n.vx = -n.vx; } else if (n.x > an) { n.x = an; n.vx = -n.vx; }
          if (n.y < 0) { n.y = 0; n.vy = -n.vy; } else if (n.y > al) { n.y = al; n.vy = -n.vy; }
        }
        n.ax = k ? n.x + (cx - n.x) * k : n.x;
        n.ay = k ? n.y + (cy - n.y) * k : n.y;
        if (n.pulso > 0) n.pulso -= 0.013;
      }

      // enlaces entre nodos. El radio encoge con el apreton, porque si no, al
      // juntarse todos con todos se dibujarian miles de lineas por cuadro.
      var re = radioEnlace * (1 - k * 0.78);
      var r2 = re * re;
      ctx.lineWidth = 1;
      for (var a = 0; a < nodos.length; a++) {
        var na = nodos[a];
        for (var b = a + 1; b < nodos.length; b++) {
          var nb = nodos[b];
          var dx = na.ax - nb.ax, dy = na.ay - nb.ay, d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          var f = 1 - d2 / r2;
          var vivo = Math.max(na.pulso, nb.pulso);
          // al cerrarse el nudo las lineas se van poniendo calidas: lo que
          // antes eran conversaciones sueltas acaba siendo una sola cosa
          ctx.strokeStyle = 'rgba(' + (vivo > 0 || conv > 0.55 ? acento : tinta) + ',' +
            (f * (vivo > 0 ? 0.5 + vivo * 0.3 : 0.2 + conv * 0.22)).toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(na.ax, na.ay);
          ctx.lineTo(nb.ax, nb.ay);
          ctx.stroke();
        }
      }

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
    function para() { if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

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
      converger: converger, setFoco: setFoco,
      para: para, arranca: arranca, medir: medir,
      nodos: nodos, cuadros: function () { return t; }
    };
  }

  global.redDeNodos = redDeNodos;
})(window);
