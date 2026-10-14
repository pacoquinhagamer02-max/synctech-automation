/* SyncTech — interações da landing (3D, mouse e rolagem).
   Arquivo à parte do React: só lê o DOM já renderizado e anima por CSS
   variables / propriedades individuais, sem reescrever nós que o React
   controla. Tudo desliga com prefers-reduced-motion. */
(function () {
  'use strict';
  var semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mouseFino = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (semMovimento) return;

  /* ═══════════ Fundo de seda (WebGL, shader próprio) ═══════════ */
  function seda() {
    var fundo = document.querySelector('.fundo');
    if (!fundo) return;
    var cv = document.createElement('canvas');
    cv.className = 'seda';
    cv.setAttribute('aria-hidden', 'true');
    fundo.insertBefore(cv, fundo.firstChild);
    var gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) { cv.remove(); return; }
    var vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var fs = [
      'precision mediump float;uniform vec2 r;uniform float t;uniform vec2 m;',
      'void main(){',
      ' vec2 uv=gl_FragCoord.xy/r; vec2 p=uv*2.-1.; p.x*=r.x/r.y;',
      ' float tt=t*.09; vec2 q=p*1.15;',
      ' for(int i=1;i<5;i++){float f=float(i);',
      '  q+=vec2(.55/f*sin(f*q.y+tt+.35*f)+.7,.38/f*sin(q.x*f+tt*1.3+.3*f)-.7);}',
      ' float s=.5+.5*sin(q.x+q.y+tt);',
      ' float b=smoothstep(.15,1.,s);',
      ' vec3 base=vec3(.039,.027,.078), vio=vec3(.42,.24,.85), lil=vec3(.80,.67,1.);',
      ' vec3 c=mix(base,vio,b*.42); c=mix(c,lil,pow(b,7.)*.30);',
      ' c+=vec3(.36,.2,.75)*.10*smoothstep(.5,0.,distance(uv,m));',
      ' c=mix(base,c,smoothstep(1.35,.15,length(p*vec2(.75,1.))));',
      ' gl_FragColor=vec4(c,1.);}'
    ].join('\n');
    function sh(tipo, src) { var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { cv.remove(); return; }
    gl.useProgram(pr);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't'), uM = gl.getUniformLocation(pr, 'm');
    // Resolução baixa de propósito: a seda é suave, e isso poupa a GPU do celular.
    var escala = mouseFino ? 0.5 : 0.35;
    function tamanho() {
      cv.width = Math.max(2, Math.round(innerWidth * escala));
      cv.height = Math.max(2, Math.round(innerHeight * escala));
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(uR, cv.width, cv.height);
    }
    tamanho();
    addEventListener('resize', tamanho);
    var mx = .5, my = .6, tx = .5, ty = .6;
    if (mouseFino) addEventListener('pointermove', function (e) { tx = e.clientX / innerWidth; ty = 1 - e.clientY / innerHeight; }, { passive: true });
    var t0 = performance.now(), ultimo = 0, intervalo = mouseFino ? 0 : 1000 / 30;
    function quadro(agora) {
      requestAnimationFrame(quadro);
      if (document.hidden || agora - ultimo < intervalo) return;
      ultimo = agora;
      mx += (tx - mx) * .05; my += (ty - my) * .05;
      gl.uniform1f(uT, (agora - t0) / 1000);
      gl.uniform2f(uM, mx, my);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(quadro);
    requestAnimationFrame(function () { cv.classList.add('ligada'); });
  }

  /* ═══════════ Faísca no clique ═══════════ */
  function faisca() {
    var cv = document.createElement('canvas');
    cv.className = 'faisca';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    var ctx = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), sparks = [], rodando = false;
    function tamanho() { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
    tamanho(); addEventListener('resize', tamanho);
    function desenhar(agora) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      sparks = sparks.filter(function (s) {
        var p = (agora - s.t) / 450;
        if (p >= 1) return false;
        var e = 1 - Math.pow(1 - p, 3), d = e * 26 * dpr, len = 9 * dpr * (1 - e);
        ctx.strokeStyle = 'rgba(205,170,255,' + (1 - p) + ')';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.a), s.y + d * Math.sin(s.a));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.a), s.y + (d + len) * Math.sin(s.a));
        ctx.stroke();
        return true;
      });
      if (sparks.length) requestAnimationFrame(desenhar); else { rodando = false; ctx.clearRect(0, 0, cv.width, cv.height); }
    }
    addEventListener('pointerdown', function (e) {
      var t = performance.now();
      for (var i = 0; i < 8; i++) sparks.push({ x: e.clientX * dpr, y: e.clientY * dpr, a: i * Math.PI / 4, t: t });
      if (!rodando) { rodando = true; requestAnimationFrame(desenhar); }
    }, { passive: true });
  }

  /* ═══════════ Brilho que segue o cursor + borda luminosa + inclinação ═══════════ */
  function mouse() {
    if (!mouseFino) return;
    var luz = document.createElement('div');
    luz.className = 'luz-cursor';
    luz.setAttribute('aria-hidden', 'true');
    document.body.appendChild(luz);
    var x = innerWidth / 2, y = innerHeight / 3, lx = x, ly = y;
    (function seguir() {
      lx += (x - lx) * .12; ly += (y - ly) * .12;
      luz.style.transform = 'translate3d(' + (lx - 300) + 'px,' + (ly - 300) + 'px,0)';
      requestAnimationFrame(seguir);
    })();

    var atual = null;
    addEventListener('pointermove', function (e) {
      x = e.clientX; y = e.clientY;
      var card = e.target.closest && e.target.closest('.card');
      if (atual && atual !== card) { atual.style.setProperty('--mrx', '0deg'); atual.style.setProperty('--mry', '0deg'); }
      atual = card;
      if (!card) return;
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      var forca = card.hasAttribute('data-tilt') ? 10 : (r.width * r.height > 260000 ? 1.5 : 4);
      card.style.setProperty('--mry', ((px - .5) * forca * 2) + 'deg');
      card.style.setProperty('--mrx', ((.5 - py) * forca * 2) + 'deg');
    }, { passive: true });
    document.addEventListener('pointerleave', function () {
      if (atual) { atual.style.setProperty('--mrx', '0deg'); atual.style.setProperty('--mry', '0deg'); atual = null; }
    });

    // Botões magnéticos: puxam levemente na direção do cursor.
    addEventListener('pointermove', function (e) {
      document.querySelectorAll('[data-magnetico]').forEach(function (b) {
        var r = b.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy, dist = Math.hypot(dx, dy);
        if (dist < 140) b.style.translate = (dx * .22) + 'px ' + (dy * .3) + 'px';
        else if (b.style.translate) b.style.translate = '';
      });
    }, { passive: true });
  }

  /* ═══════════ Rolagem (Lenis + GSAP ScrollTrigger) ═══════════ */
  function rolagem() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) return;
    gsap.registerPlugin(ST);

    var lenis = null;
    if (mouseFino && window.Lenis) {
      lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
      document.documentElement.classList.add('lenis-on');
      lenis.on('scroll', ST.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      // Âncoras (#planos, #contato…) passam pelo Lenis, descontando o menu fixo.
      document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a || a.target === '_blank') return;
        var id = a.getAttribute('href');
        var alvo = id.length > 1 && document.querySelector(id);
        if (!alvo) return;
        e.preventDefault();
        lenis.scrollTo(alvo, { offset: -90 });
        history.replaceState(null, '', id);
      });
    }

    // Hero: o título entra linha a linha.
    gsap.from('#topo h1 .linha', { yPercent: 60, opacity: 0, filter: 'blur(10px)', duration: 1.1, ease: 'power3.out', stagger: .14, delay: .15 });

    // Mockup do WhatsApp: gira em 3D enquanto a hero sai da tela.
    var mock = document.querySelector('[data-tilt]');
    if (mock) gsap.fromTo(mock, { '--srx': '0deg', '--ssc': 1 }, {
      '--srx': '16deg', '--ssc': .9, ease: 'none',
      scrollTrigger: { trigger: '#topo', start: 'top top', end: 'bottom top', scrub: true }
    });

    // Cartões sobem em 3D ao entrar na tela.
    gsap.utils.toArray('main .card').forEach(function (c) {
      if (c.hasAttribute('data-tilt') || c.closest('#topo')) return;
      gsap.fromTo(c, { '--srx': '22deg', '--ssc': .94 }, {
        '--srx': '0deg', '--ssc': 1, ease: 'none',
        scrollTrigger: { trigger: c, start: 'top 100%', end: 'top 68%', scrub: .6 }
      });
    });

    // Títulos de seção: sobem e perdem o desfoque conforme a página desce.
    gsap.utils.toArray('main section h2').forEach(function (h) {
      gsap.fromTo(h, { y: 40, opacity: .15, filter: 'blur(8px)' }, {
        y: 0, opacity: 1, filter: 'blur(0px)', ease: 'none',
        scrollTrigger: { trigger: h, start: 'top 95%', end: 'top 62%', scrub: .5 }
      });
    });

    // Texto do case: acende palavra por palavra com a rolagem.
    gsap.utils.toArray('[data-palavras]').forEach(function (bloco) {
      var ps = bloco.querySelectorAll('.palavra');
      if (!ps.length) return;
      gsap.fromTo(ps, { opacity: .14 }, {
        opacity: 1, stagger: .05, ease: 'none',
        scrollTrigger: { trigger: bloco, start: 'top 85%', end: 'bottom 55%', scrub: true }
      });
    });

    // Parallax do fundo: as luzes andam mais devagar que a página.
    var fundo = document.querySelector('.fundo');
    if (fundo) gsap.to(fundo, {
      '--py': '-260px', ease: 'none',
      scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: true }
    });

    // Letreiro inclina conforme a velocidade da rolagem.
    var letreiro = document.querySelector('[aria-label="Destaques da SyncTech"]');
    if (letreiro) {
      var inclina = gsap.quickTo(letreiro, 'skewX', { duration: .4, ease: 'power3' });
      ST.create({ onUpdate: function (s) { inclina(gsap.utils.clamp(-8, 8, s.getVelocity() / -300)); } });
      ST.addEventListener('scrollEnd', function () { inclina(0); });
    }

    // Mudanças de altura (calculadora, plano anual, FAQ) recalculam as posições.
    var espera;
    new ResizeObserver(function () { clearTimeout(espera); espera = setTimeout(function () { ST.refresh(); }, 200); })
      .observe(document.getElementById('root'));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ST.refresh(); });
  }

  /* ═══════════ Início: espera o React desenhar a página ═══════════ */
  var tentativas = 0;
  function quandoPronto() {
    if (document.querySelector('#topo h1') && document.querySelector('#contato')) {
      faisca();
      mouse();
      rolagem();
      // No celular a seda espera a página assentar, para não pesar no carregamento.
      setTimeout(seda, mouseFino ? 300 : 3500);
      return;
    }
    if (++tentativas < 200) setTimeout(quandoPronto, 50);
  }
  quandoPronto();
})();
