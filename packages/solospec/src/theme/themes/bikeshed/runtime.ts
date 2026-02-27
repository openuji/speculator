
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    const root = document.querySelector('[data-solospec-theme="bikeshed"]') as HTMLElement;
    if (!root) return;

    const toc = document.getElementById('toc');
    if (!toc) return;

    
    const mobuleToc = toc.cloneNode(true) as HTMLElement;
    mobuleToc.setAttribute('id', 'toc-mobile');
    

    const mq = window.matchMedia('(max-width: 1247px)');
    const firstLink = toc.querySelector('a[href^="#"]');
    if(!firstLink) return;
    
    const targetId = firstLink.getAttribute('href')?.substring(1);
    const targetSection = root.querySelector(`section#${targetId}`);
    const parent = targetSection?.parentNode;
    if(!targetSection || !parent) return;

    const updateToc = () => {
      if (mq.matches) {
        // Move TOC inline
        targetSection.before(mobuleToc);
        root.setAttribute('data-toc-inline', 'true');
      } else {
        // Restore TOC to sidebar
        parent.removeChild(mobuleToc);
        root.removeAttribute('data-toc-inline');
      }
    };

    mq.addEventListener('change', updateToc);
    updateToc();
  })

}