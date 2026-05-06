(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const componentCache = new Map();

  const fetchComponent = async (name) => {
    if (componentCache.has(name)) return componentCache.get(name);
    const response = await fetch(`/components/${name}.html`, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`Component ${name} failed`);
    const html = await response.text();
    componentCache.set(name, html);
    return html;
  };

  const markActiveLinks = () => {
    const current = location.pathname === '/' ? '/index.html' : location.pathname;
    $$('[data-nav-link]').forEach((link) => {
      const href = new URL(link.getAttribute('href'), location.origin).pathname;
      const isProducts = current.startsWith('/products/') && href === '/products.html';
      if (href === current || isProducts) link.classList.add('is-active');
    });
  };

  const initHeader = () => {
    const header = $('[data-header]');
    const nav = $('#site-navigation');
    const toggle = $('.nav-toggle');
    const dropdownToggle = $('.dropdown-toggle');
    const dropdownParent = $('.has-dropdown');
    if (!header || !nav || !toggle) return;

    const setMenu = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
      document.body.classList.toggle('nav-open', open);
    };

    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a') && innerWidth <= 900) setMenu(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setMenu(false);
        dropdownParent?.classList.remove('is-open');
        dropdownToggle?.setAttribute('aria-expanded', 'false');
      }
    });

    dropdownToggle?.addEventListener('click', () => {
      const open = !dropdownParent.classList.contains('is-open');
      dropdownParent.classList.toggle('is-open', open);
      dropdownToggle.setAttribute('aria-expanded', String(open));
    });

    let ticking = false;
    const updateHeader = () => {
      header.classList.toggle('is-scrolled', scrollY > 8);
      ticking = false;
    };
    updateHeader();
    addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }, { passive: true });
  };

  const loadComponents = async () => {
    const slots = $$('[data-component]');
    await Promise.all(slots.map(async (slot) => {
      slot.innerHTML = await fetchComponent(slot.dataset.component);
    }));
    markActiveLinks();
    initHeader();
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  };

  const initReveal = () => {
    const items = $$('[data-reveal]');
    if (!items.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .12 });
    items.forEach((item) => observer.observe(item));
  };

  const initProductFilters = () => {
    const grid = $('[data-products-grid]');
    if (!grid) return;
    const buttons = $$('.filter-btn');
    const cards = $$('[data-filter-item]', grid);
    const emptyState = $('[data-empty-state]');

    const applyFilter = (category, updateUrl = true) => {
      let visible = 0;
      cards.forEach((card) => {
        const show = category === 'all' || card.dataset.category === category;
        card.hidden = !show;
        if (show) visible += 1;
      });
      buttons.forEach((button) => {
        const isActive = button.dataset.filter === category;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });
      if (emptyState) emptyState.hidden = visible !== 0;
      if (updateUrl) {
        const url = new URL(location.href);
        category === 'all' ? url.searchParams.delete('category') : url.searchParams.set('category', category);
        history.replaceState({}, '', url);
      }
    };

    buttons.forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
    const initial = new URLSearchParams(location.search).get('category');
    const hasInitial = buttons.some((button) => button.dataset.filter === initial);
    const selectedCategory = hasInitial ? initial : 'all';
    const shouldNormalizeUrl = initial === 'all' || (initial && !hasInitial);
    applyFilter(selectedCategory, shouldNormalizeUrl);
  };

  const submitForm = async (form, messageBox) => {
    const button = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    if (!formData.has('form-name')) formData.append('form-name', form.name);
    button.disabled = true;
    button.textContent = 'Изпращане...';
    try {
      await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      });
      messageBox.hidden = false;
      messageBox.className = 'form-message is-success';
      messageBox.textContent = form.dataset.form === 'order'
        ? 'Заявката е получена и очаква преглед от пекарната. Ще се свържем с вас за потвърждение.'
        : 'Съобщението е получено. Ще се свържем с вас възможно най-скоро.';
      form.reset();
    } catch (error) {
      messageBox.hidden = false;
      messageBox.className = 'form-message is-error';
      messageBox.textContent = 'Възникна проблем при изпращането. Моля, опитайте отново или се свържете с нас по телефон.';
    } finally {
      button.disabled = false;
      button.textContent = form.dataset.form === 'order' ? 'Изпрати заявка' : 'Изпрати съобщение';
    }
  };

  const initForms = () => {
    const params = new URLSearchParams(location.search);
    const product = params.get('product');
    const success = params.get('success');
    const productSelect = $('#product');
    if (product && productSelect) productSelect.value = product;

    $$('form[data-form]').forEach((form) => {
      const messageBox = $('[data-form-message]', form);
      if (success === 'true' && messageBox) {
        messageBox.hidden = false;
        messageBox.className = 'form-message is-success';
        messageBox.textContent = form.dataset.form === 'order'
          ? 'Заявката е получена и очаква преглед от пекарната. Ще се свържем с вас за потвърждение.'
          : 'Съобщението е получено. Ще се свържем с вас възможно най-скоро.';
      }
      form.addEventListener('submit', (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          form.reportValidity();
          return;
        }
        if (messageBox && window.fetch) {
          event.preventDefault();
          submitForm(form, messageBox);
        }
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadComponents().catch(() => {});
    initReveal();
    initProductFilters();
    initForms();
  });
})();
