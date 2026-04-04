/** @file Hub page — card fade-in animation */
(function() {
  var hub = document.querySelector('.hub');
  var cards = document.querySelectorAll('.story-card');
  if (!hub || !cards.length) return;

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    hub.classList.add('animate-cards');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var idx = Array.prototype.indexOf.call(cards, entry.target);
          setTimeout(function() { entry.target.classList.add('visible'); }, idx % 3 * 100);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    cards.forEach(function(card) { observer.observe(card); });
  } else {
    cards.forEach(function(card) { card.classList.add('visible'); });
  }
})();
