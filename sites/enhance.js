(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent =
    '.sy-reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,.8,.3,1),transform .7s cubic-bezier(.16,.8,.3,1)}' +
    '.sy-in{opacity:1;transform:translateY(0)}' +
    '.sy-tilt{will-change:transform}';
  document.head.appendChild(style);

  if (reduce) return;

  // ── Scroll reveal ──
  var revealSel = 'section, .dor-card, .incluso-item, .proc-item, .faq-item, .case, .price-box';
  var revealEls = document.querySelectorAll(revealSel);
  revealEls.forEach(function(el){ el.classList.add('sy-reveal'); });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('sy-in');
          io.unobserve(entry.target);
        }
      });
    }, {threshold: 0.12});
    revealEls.forEach(function(el){ io.observe(el); });
    setTimeout(function(){
      revealEls.forEach(function(el){ el.classList.add('sy-in'); });
      io.disconnect();
    }, 1200);
  } else {
    revealEls.forEach(function(el){ el.classList.add('sy-in'); });
  }

  // ── Tilt 3D nos cards ──
  if (window.matchMedia('(hover: hover)').matches) {
    var tiltEls = document.querySelectorAll('.dor-card, .incluso-item');
    tiltEls.forEach(function(el){
      el.classList.add('sy-tilt');
      el.style.transition = 'transform .15s ease';
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(700px) rotateX(' + (py * -6) + 'deg) rotateY(' + (px * 6) + 'deg) translateY(-3px)';
      });
      el.addEventListener('mouseleave', function(){ el.style.transform = ''; });
    });
  }

  // ── Contagem nos números reais (mesmo valor, só anima a chegada) ──
  function animateCount(el){
    var text = el.textContent;
    var m = text.match(/\d+(?:[.,]\d+)?/);
    if (!m) return;
    var raw = m[0];
    var prefix = text.slice(0, m.index);
    var suffix = text.slice(m.index + raw.length);
    var target;
    if (/,\d{1,2}$/.test(raw) && !/\.\d{3}/.test(raw)) {
      target = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    } else {
      target = parseFloat(raw.replace(/[.,]/g, ''));
    }
    if (isNaN(target)) return;
    var start = performance.now();
    var duration = 900;
    function frame(now){
      var p = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var current = Math.round(target * eased);
      el.textContent = prefix + current + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = text;
    }
    requestAnimationFrame(frame);
  }
  var countEls = document.querySelectorAll('.proof-item b, .case-stats b');
  if ('IntersectionObserver' in window) {
    var countDone = new WeakSet();
    var ioCount = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting && !countDone.has(entry.target)) {
          countDone.add(entry.target);
          animateCount(entry.target);
          ioCount.unobserve(entry.target);
        }
      });
    }, {threshold: 0.4});
    countEls.forEach(function(el){ ioCount.observe(el); });
    setTimeout(function(){
      countEls.forEach(function(el){ if (!countDone.has(el)) { countDone.add(el); animateCount(el); } });
      ioCount.disconnect();
    }, 1500);
  }

  // ── Fundo ambiente no hero (canvas leve, sem bibliotecas) ──
  var hero = document.querySelector('.hero');
  if (hero) {
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.55;z-index:0';
    hero.style.position = hero.style.position || 'relative';
    hero.insertBefore(canvas, hero.firstChild);
    var ctx = canvas.getContext('2d');
    var dots = [];
    function resize(){
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    var colors = ['rgba(180,79,255,', 'rgba(34,211,238,'];
    for (var i = 0; i < 26; i++) {
      dots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: 1 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        c: colors[i % 2],
        a: 0.25 + Math.random() * 0.4
      });
    }
    function tick(){
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach(function(d){
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > canvas.width) d.vx *= -1;
        if (d.y < 0 || d.y > canvas.height) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = d.c + d.a + ')';
        ctx.fill();
      });
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
})();
