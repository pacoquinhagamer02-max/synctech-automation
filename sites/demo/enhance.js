(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent =
    '.sy-reveal{opacity:0;transform:translateY(22px);transition:opacity .5s cubic-bezier(.16,.8,.3,1),transform .5s cubic-bezier(.16,.8,.3,1)}' +
    '.sy-in{opacity:1;transform:translateY(0)}' +
    '.sy-tilt{will-change:transform}';
  document.head.appendChild(style);

  if (reduce) return;

  var heroStyle = document.createElement('style');
  heroStyle.textContent =
    '.hero-content{opacity:0;transform:translateY(16px);animation:sy-hero-in .8s cubic-bezier(.16,.8,.3,1) .1s forwards}' +
    '@keyframes sy-hero-in{to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(heroStyle);

  var revealSel = 'section, .cat, .cat-card, .serv, .oc, .info-band, .trust, .trust-item, .diff-item, .heritage, .ig-band, .delivery, .quote';
  var revealEls = document.querySelectorAll(revealSel);

  // Entrada escalonada: cards do mesmo grid aparecem em sequencia, nao todos de uma vez.
  var cardEls = document.querySelectorAll('.cat, .cat-card, .serv, .oc, .trust-item, .diff-item');
  var staggerCount = new Map();
  cardEls.forEach(function(el){
    var p = el.parentElement;
    var idx = staggerCount.get(p) || 0;
    el.style.transitionDelay = Math.min(idx * 70, 350) + 'ms';
    staggerCount.set(p, idx + 1);
  });

  if ('IntersectionObserver' in window) {
    revealEls.forEach(function(el){ el.classList.add('sy-reveal'); });
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if (entry.isIntersecting) {
          entry.target.classList.add('sy-in');
          io.unobserve(entry.target);
        }
      });
    }, {threshold: 0.12});
    revealEls.forEach(function(el){ io.observe(el); });
    // Rede de seguranca: se o navegador nao disparar o observer (webview restrito,
    // aba em segundo plano, etc.), o conteudo aparece de qualquer forma.
    setTimeout(function(){
      revealEls.forEach(function(el){ el.classList.add('sy-in'); });
      io.disconnect();
    }, 1200);
  }

  var heroImg = document.querySelector('.hero img');
  if (heroImg) {
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      if (y < window.innerHeight * 1.3) {
        heroImg.style.transform = 'translateY(' + (y * 0.15) + 'px) scale(1.06)';
      }
    }, {passive: true});
  }

  if (window.matchMedia('(hover: hover)').matches) {
    var tiltEls = document.querySelectorAll('.cat, .cat-card, .serv, .oc');
    tiltEls.forEach(function(el){
      el.classList.add('sy-tilt');
      // Duracao curta so pro transform (resposta do mouse), sem mexer no
      // transition-delay do stagger nem na duracao do opacity da entrada.
      el.style.transitionDuration = '.5s, .15s';
      el.addEventListener('mousemove', function(e){
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(700px) rotateX(' + (py * -7) + 'deg) rotateY(' + (px * 7) + 'deg) translateY(-3px)';
      });
      el.addEventListener('mouseleave', function(){
        el.style.transform = '';
      });
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
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = text;
    }
    requestAnimationFrame(frame);
  }
  var countEls = document.querySelectorAll('.trust-item b, .trust b, .diff-item b, .heritage b');
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
})();
