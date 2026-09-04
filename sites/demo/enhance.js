(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var style = document.createElement('style');
  style.textContent =
    '.sy-reveal{opacity:0;transform:translateY(22px);transition:opacity .7s cubic-bezier(.16,.8,.3,1),transform .7s cubic-bezier(.16,.8,.3,1)}' +
    '.sy-in{opacity:1;transform:translateY(0)}' +
    '.sy-tilt{will-change:transform}';
  document.head.appendChild(style);

  if (reduce) return;

  var revealSel = 'section, .cat, .cat-card, .serv, .oc, .info-band, .trust, .trust-item, .diff-item, .heritage, .ig-band, .delivery, .quote';
  var revealEls = document.querySelectorAll(revealSel);
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
      el.style.transition = 'transform .15s ease';
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
})();
