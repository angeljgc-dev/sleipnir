/* Portada de Sleipnir.

   Orden deliberado:
   1. El nombre se descifra con una funcion propia de unas treinta lineas, no con
      un plugin. El motivo es medido, no estetico: el revoltijo tiene que soltar
      la pagina antes de 1.2 s desde el primer pintado, y si depende de que bajen
      28 kB de motor desde un CDN, en una red lenta no llega. El plugin de GSAP
      sigue siendo la herramienta correcta para cualquier revoltijo posterior a
      la carga; para el nombre, no cabe en el presupuesto.
   2. La red arranca despues, y solo si hace falta.
   3. El motor de scroll se baja al final, cuando la portada ya esta entregada.

   Nada de esto corre si el visitante pidio movimiento reducido: en ese caso la
   marca data-js no existe y el HTML se queda como esta, completo y legible. */

(function () {
  'use strict';

  var raiz = document.documentElement;
  if (!raiz.dataset.js) return;

  var nombre = document.getElementById('nombre');
  var celdas = nombre ? [].slice.call(nombre.querySelectorAll('.celda')) : [];
  var canvas = document.getElementById('red');
  var pildora = document.getElementById('pildora');
  var hueco = document.getElementById('hueco');
  var estados = document.getElementById('estados');
  var items = estados ? [].slice.call(estados.children) : [];
  var anclas = [].slice.call(document.querySelectorAll('.ancla'));
  var red = null;
  var cual = 0;

  /* ---------------- el nombre se descifra ---------------- */

  var ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function descifrar(listo) {
    if (!celdas.length) return listo();
    var reales = celdas.map(function (c) { return c.textContent; });
    var t0 = performance.now();
    var RETRASO = 52;   // ms entre una letra y la siguiente
    var RUIDO = 300;    // ms que cada letra pasa revuelta
    var PASO = 42;      // cada cuanto cambia el caracter al azar
    var ultimo = -1e9;

    function cuadro(ahora) {
      var t = ahora - t0;
      var cambia = ahora - ultimo >= PASO;
      if (cambia) ultimo = ahora;
      var faltan = 0;
      for (var i = 0; i < celdas.length; i++) {
        var propio = t - i * RETRASO;
        if (propio < RUIDO) {
          faltan++;
          if (cambia) celdas[i].textContent = ALFABETO.charAt((Math.random() * 36) | 0);
        } else if (celdas[i].textContent !== reales[i]) {
          celdas[i].textContent = reales[i];
        }
      }
      if (faltan) requestAnimationFrame(cuadro);
      else { performance.mark('nombre-listo'); listo(); }
    }
    requestAnimationFrame(cuadro);
  }

  /* ---------------- la red ---------------- */

  function posicionesDeAnclas() {
    if (!canvas) return [];
    var c = canvas.getBoundingClientRect();
    return anclas.map(function (a) {
      var p = a.querySelector('.ancla__punto').getBoundingClientRect();
      return [p.left + p.width / 2 - c.left, p.top + p.height / 2 - c.top];
    });
  }

  function arrancaRed() {
    if (!canvas || !window.redDeNodos) return;
    // Dos razones para no cargarla: el visitante pidio ahorrar datos, o el
    // aparato tiene poca memoria. En los dos casos la lamina queda como plano.
    var con = navigator.connection;
    if ((con && con.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2)) return;

    red = window.__red = window.redDeNodos(canvas, { maxNodos: 72, radioEnlace: 128 });
    red.setAnclas(posicionesDeAnclas());
    canvas.classList.add('viva');
    addEventListener('resize', function () {
      red.medir();
      red.setAnclas(posicionesDeAnclas());
    }, { passive: true });
  }

  /* ---------------- la pildora viva ---------------- */

  function anchoDeEstados() {
    var w = 0;
    items.forEach(function (li) { w = Math.max(w, Math.ceil(li.offsetWidth)); });
    return w;
  }

  function pintaEstado(n) {
    items.forEach(function (li, i) {
      li.classList.toggle('activo', i === n);
      li.classList.toggle('sale', i !== n);
    });
    estados.style.width = Math.ceil(items[n].offsetWidth) + 'px';
    if (red) {
      var k = red.mensaje(n % anclas.length);
      var a = anclas[k];
      if (a) {
        a.classList.add('late');
        setTimeout(function () { a.classList.remove('late'); }, 900);
      }
    }
  }

  function arrancaPildora() {
    if (!estados || !items.length) return;
    // El ancho se fija con la tipografia ya cargada; si no, la pildora mide mal.
    estados.style.width = anchoDeEstados() + 'px';
    pintaEstado(0);
    setInterval(function () {
      cual = (cual + 1) % items.length;
      pintaEstado(cual);
    }, 3200);
  }

  /* ---------------- coreografia de scroll (se baja al final) ---------------- */

  function trae(url) {
    return new Promise(function (ok, mal) {
      var s = document.createElement('script');
      s.src = url; s.async = true;
      s.onload = ok; s.onerror = mal;
      document.head.appendChild(s);
    });
  }

  var CDN = 'https://cdn.jsdelivr.net/npm/';

  function cargaMotor() {
    return trae(CDN + 'gsap@3.15.0/dist/gsap.min.js')
      .then(function () {
        return Promise.all([
          trae(CDN + 'gsap@3.15.0/dist/ScrollTrigger.min.js'),
          trae(CDN + 'gsap@3.15.0/dist/SplitText.min.js'),
          trae(CDN + 'lenis@1.3.26/dist/lenis.min.js')
        ]);
      })
      .then(montaScroll)
      .catch(function () { /* sin motor la pagina sigue entera, solo sin coreografia */ });
  }

  function montaScroll() {
    var gsap = window.gsap;
    if (!gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(window.ScrollTrigger, window.SplitText);

    if (window.Lenis) {
      var lenis = new window.Lenis({ lerp: 0.09 });
      lenis.on('scroll', window.ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    var losa = document.querySelector('.losa');
    var radio = parseFloat(getComputedStyle(losa).borderTopLeftRadius) || 22;

    // La portada no se corta: se queda atras mientras la losa de papel sube.
    gsap.timeline({
      scrollTrigger: { trigger: losa, start: 'top bottom', end: 'top top', scrub: 0.4 }
    })
      .fromTo(losa, { borderTopLeftRadius: radio, borderTopRightRadius: radio },
                    { borderTopLeftRadius: 0, borderTopRightRadius: 0, duration: 1, ease: 'none' }, 0)
      .fromTo('.bloque', { y: 0, opacity: 1 }, { y: -46, opacity: 0.22, duration: 1, ease: 'none' }, 0)
      .fromTo(['.lamina__red', '.lamina__rotulo', '.anclas'],
              { opacity: 1 }, { opacity: 0.1, duration: 1, ease: 'none' }, 0)
      .fromTo('.baja', { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, 0)
      // el rotulo, el pie y el filete se van primero: la pildora se queda sola
      // y se acopla
      .fromTo(['.ficha__titulo', '.ficha__pie'], { opacity: 1 }, { opacity: 0, duration: 0.3, ease: 'none' }, 0)
      .fromTo('.ficha', { borderTopColor: 'rgba(25,29,37,1)' },
                        { borderTopColor: 'rgba(25,29,37,0)', duration: 0.3, ease: 'none' }, 0);

    // El titulo de la losa entra por lineas, como lo hace Heron AI.
    try {
      var partido = new window.SplitText('.losa__titulo', { type: 'lines', linesClass: 'linea' });
      gsap.from(partido.lines, {
        yPercent: 108, opacity: 0, duration: 0.8, stagger: 0.09, ease: 'power3.out',
        scrollTrigger: { trigger: '.losa__titulo', start: 'top 86%' }
      });
      document.querySelectorAll('.losa__titulo .linea').forEach(function (l) {
        l.style.display = 'block';
        l.style.overflow = 'visible';
      });
    } catch (e) { /* si SplitText no llega, el titulo ya esta escrito */ }

    gsap.from('.verbos li', {
      opacity: 0, y: 16, duration: 0.6, stagger: 0.07, ease: 'power2.out',
      scrollTrigger: { trigger: '.verbos', start: 'top 92%' }
    });

    acopla(losa);
  }

  // La pildora sube con la pagina hasta que topa con la barra, y ahi se queda
  // como indicador en vivo. Mientras sube se corre a la derecha y encoge: no es
  // un corte, es el mismo objeto cambiando de sitio.
  //
  // En telefono pasa exactamente lo mismo. Lo unico que cambia es cuanto
  // encoge: en una barra angosta la escala se calcula contra el hueco que
  // queda a la derecha de la marca, para que el estado mas largo de los cuatro
  // entre entero. Recortar el texto seria peor que no acoplar, asi que si ni
  // encogiendo cabe, la pildora se va con la pagina y no se acopla.
  function acopla(losa) {
    var ficha = document.querySelector('.ficha');
    var marca = document.querySelector('.barra__marca');
    var muelle = document.getElementById('muelle');
    var ESC = 0.84;
    var acoplado = 0;      // ancho que ocupa la pildora ya encogida
    var cabe = true;
    var fijo = false;

    function num(prop, porDefecto) {
      return parseFloat(getComputedStyle(raiz).getPropertyValue(prop)) || porDefecto;
    }

    // El ancho de la pildora cambia con cada estado, asi que la escala se mide
    // contra el estado mas ancho de los cuatro y no contra el que este puesto:
    // asi no baila cada 3.2 s.
    function mide() {
      var alrededor = pildora.offsetWidth - estados.offsetWidth;  // punto, hueco y margenes
      var ancho = anchoDeEstados() + alrededor;
      var margen = num('--g', 40);
      var libre = innerWidth - margen * 2 - marca.offsetWidth - 16;
      ESC = Math.min(0.84, libre / ancho);
      acoplado = ancho * ESC;
      cabe = ESC >= 0.74;
      return cabe;
    }

    function coloca() {
      if (!fijo) return;
      var margen = num('--g', 40);
      var r = hueco.getBoundingClientRect();         // donde estaria en reposo
      var y = window.scrollY || window.pageYOffset;
      var metaY = (num('--barra', 64) - pildora.offsetHeight * ESC) / 2;
      var reposoDoc = r.top + y;
      var q = Math.min(1, Math.max(0, y / Math.max(1, reposoDoc - metaY)));

      pildora.style.top = Math.max(metaY, reposoDoc - y) + 'px';
      pildora.style.transform = 'scale(' + (1 - (1 - ESC) * q) + ')';
      if (q >= 1) {
        // Ya acoplada se ancla por la derecha: un estado mas largo crece hacia
        // dentro de la barra y nunca se sale por el borde.
        pildora.style.left = 'auto';
        pildora.style.right = margen + 'px';
        pildora.style.transformOrigin = 'right center';
      } else {
        var metaX = innerWidth - margen - pildora.offsetWidth * ESC;
        pildora.style.right = 'auto';
        pildora.style.left = (r.left + (metaX - r.left) * q) + 'px';
        pildora.style.transformOrigin = 'left center';
      }
    }

    function agarra() {
      if (fijo) return;
      fijo = true;
      ficha.style.zIndex = '60';
      pildora.style.position = 'fixed';
      // el muelle le reserva sitio dentro de la barra, para que el giro se
      // recorte solo y nunca quede por debajo de la pildora
      muelle.style.width = Math.ceil(acoplado + 12) + 'px';
    }

    function suelta() {
      fijo = false;
      pildora.style.position = '';
      pildora.style.left = pildora.style.right = pildora.style.top = '';
      pildora.style.transform = '';
      pildora.style.transformOrigin = '';
      ficha.style.zIndex = '';
      muelle.style.width = '';
    }

    mide();

    window.ScrollTrigger.create({
      trigger: losa, start: 'top bottom', end: 'top top', scrub: true,
      onUpdate: function (self) {
        if (self.progress <= 0 || !cabe) { if (fijo) suelta(); return; }
        agarra();
        coloca();
      },
      onLeaveBack: suelta
    });

    addEventListener('resize', function () {
      if (!mide() && fijo) suelta();
      coloca();
    }, { passive: true });
  }

  /* ---------------- arranque ---------------- */

  // Esperamos un cuadro para no competir con el primer pintado, y arrancamos.
  requestAnimationFrame(function () {
    descifrar(function () {
      arrancaPildora();
    });
    // La red entra en cuanto el nombre esta en vuelo, no antes.
    setTimeout(arrancaRed, 140);
  });

  // Las medidas de la pildora dependen de la tipografia; se corrigen al llegar.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      if (estados && items.length) {
        estados.style.width = Math.ceil(items[cual].offsetWidth) + 'px';
      }
      if (red) red.setAnclas(posicionesDeAnclas());
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  // El motor de scroll es lo ultimo: la portada ya se entrego sin el.
  var tarde = window.requestIdleCallback || function (f) { return setTimeout(f, 900); };
  addEventListener('load', function () { tarde(cargaMotor, { timeout: 2500 }); });
})();
