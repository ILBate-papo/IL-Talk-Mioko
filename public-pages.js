(() => {
  document.querySelectorAll('[data-return-mioko]').forEach(link => {
    link.addEventListener('click', event => {
      if (window.parent !== window) {
        event.preventDefault();
        window.parent.postMessage({type:'mioko-public-return'}, location.origin);
      }
    });
  });
})();
