/* Shared cursor-following interactions for home, checker and GitHub.
   Uses delegation so dynamically created controls work without extra setup. */
(() => {
  // Keep the glow in each button's own coordinates, even while a view
  // slides. Delegation also covers buttons and repository links created later.
  // Homepage project cards retain their original SVG-based glow.
  const glowTargets = 'button, a.ui-button, a.ui-list-row, a.btn, a.wiki-btn, a.share-btn, a.icon-btn';
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;
    const link = event.target.closest(glowTargets);
    if (!link || link.disabled || link.getAttribute('aria-disabled') === 'true') return;
    const bounds = link.getBoundingClientRect();
    link.style.setProperty('--glow-x', `${event.clientX - bounds.left}px`);
    link.style.setProperty('--glow-y', `${event.clientY - bounds.top}px`);
    link.classList.add('pointer-lit');
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest(glowTargets);
    if (!link) return;
    if (event.relatedTarget instanceof Node && link.contains(event.relatedTarget)) return;
    link.classList.remove('pointer-lit');
  }, { passive: true });
  document.addEventListener('focusin', event => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest(glowTargets);
    if (link && !link.classList.contains('pointer-lit')) {
      link.style.removeProperty('--glow-x');
      link.style.removeProperty('--glow-y');
    }
  });

})();
