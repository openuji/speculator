import {
  rankSearchResults,
  type RankedSearchResult,
  type SearchIndexPayload,
} from "./rank";

let initialized = false;

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const highlight = (text: string, query: string): string => {
  if (!query.trim()) return escapeHtml(text);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
};

const getFocusableElements = (container: HTMLElement): HTMLElement[] =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true"
  );

export const initGlobalSearch = (): void => {
  if (initialized || typeof window === "undefined") {
    return;
  }
  initialized = true;

  const modal = document.querySelector<HTMLElement>("[data-search-modal]");
  const panel = document.querySelector<HTMLElement>("[data-search-modal-panel]");
  const headerInput = document.querySelector<HTMLInputElement>("[data-search-header-input]");
  const modalInput = document.querySelector<HTMLInputElement>("[data-search-modal-input]");
  const resultsContainer = document.querySelector<HTMLOListElement>("[data-search-results]");
  const status = document.querySelector<HTMLElement>("[data-search-status]");
  const openButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-search-open]"));
  const closeButtons = Array.from(document.querySelectorAll<HTMLElement>("[data-search-close]"));

  if (!modal || !panel || !headerInput || !modalInput || !resultsContainer || !status) {
    return;
  }

  let indexPromise: Promise<SearchIndexPayload> | null = null;
  let lastFocusedElement: HTMLElement | null = null;
  let activeIndex = -1;
  let renderedResults: RankedSearchResult[] = [];

  const loadIndex = async (): Promise<SearchIndexPayload> => {
    if (!indexPromise) {
      indexPromise = fetch("/search-index.json")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`Unable to load search index (${response.status})`);
          }
          return response.json() as Promise<SearchIndexPayload>;
        })
        .catch((error) => {
          indexPromise = null;
          throw error;
        });
    }

    return indexPromise;
  };

  const setActiveIndex = (nextIndex: number): void => {
    activeIndex = nextIndex;
    const links = Array.from(
      resultsContainer.querySelectorAll<HTMLAnchorElement>("[data-search-result-link]")
    );

    links.forEach((link, index) => {
      const isActive = index === activeIndex;
      link.classList.toggle("is-active", isActive);
      link.setAttribute("aria-selected", isActive ? "true" : "false");
      if (isActive) {
        link.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const renderResults = (query: string): void => {
    if (!query.trim()) {
      renderedResults = [];
      resultsContainer.innerHTML = "";
      status.textContent = "Start typing to search across both workspaces.";
      setActiveIndex(-1);
      return;
    }

    loadIndex()
      .then((index) => {
        renderedResults = rankSearchResults(query, index, 20);

        if (renderedResults.length === 0) {
          resultsContainer.innerHTML = "";
          status.textContent = `No matches for \"${query}\".`;
          setActiveIndex(-1);
          return;
        }

        status.textContent = `${renderedResults.length} result(s) for \"${query}\".`;

        resultsContainer.innerHTML = renderedResults
          .map((result, index) => {
            const headingPath = result.entry.context.headingPath?.join(" > ");
            const contextLabel = headingPath || result.entry.context.sectionTitle || "Document";
            const nodeType = result.entry.filters?.nodeType || result.entry.context.nodeType || "content";

            return `
<li>
  <a
    href="${escapeHtml(result.url)}"
    class="search-result-link"
    data-search-result-link
    data-result-index="${index}"
    role="option"
    aria-selected="false"
  >
    <div class="search-result-meta">
      <span class="search-result-workspace">${escapeHtml(result.document.workspace)}</span>
      <span class="search-result-doc">${escapeHtml(result.document.title)}</span>
      <span class="search-result-type">${escapeHtml(nodeType)}</span>
    </div>
    <p class="search-result-context">${escapeHtml(contextLabel)}</p>
    <p class="search-result-snippet">${highlight(result.entry.text, query)}</p>
  </a>
</li>`;
          })
          .join("");

        setActiveIndex(0);
      })
      .catch(() => {
        renderedResults = [];
        resultsContainer.innerHTML = "";
        status.textContent = "Search index failed to load.";
        setActiveIndex(-1);
      });
  };

  const syncQuery = (value: string, source: "header" | "modal"): void => {
    if (source === "header" && modalInput.value !== value) {
      modalInput.value = value;
    }

    if (source === "modal" && headerInput.value !== value) {
      headerInput.value = value;
    }

    renderResults(value);
  };

  const openModal = (seed = ""): void => {
    if (!modal.hidden) {
      return;
    }

    lastFocusedElement = document.activeElement as HTMLElement;
    modal.hidden = false;
    document.body.classList.add("search-open");

    const value = seed || headerInput.value || "";
    modalInput.value = value;
    renderResults(value);

    window.requestAnimationFrame(() => {
      modalInput.focus();
      modalInput.select();
    });
  };

  const closeModal = (): void => {
    if (modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.body.classList.remove("search-open");
    setActiveIndex(-1);

    if (lastFocusedElement) {
      lastFocusedElement.focus();
    } else {
      headerInput.focus();
    }
  };

  const debounce = <Args extends unknown[]>(
    callback: (...args: Args) => void,
    waitMs: number
  ): ((...args: Args) => void) => {
    let timer: number | null = null;
    return (...args: Args) => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(() => callback(...args), waitMs);
    };
  };

  const debouncedHeaderInput = debounce((value: string) => {
    openModal(value);
    syncQuery(value, "header");
  }, 80);

  headerInput.addEventListener("focus", () => openModal(headerInput.value));
  headerInput.addEventListener("input", () => debouncedHeaderInput(headerInput.value));

  modalInput.addEventListener("input", () => syncQuery(modalInput.value, "modal"));

  openButtons.forEach((button) => {
    button.addEventListener("click", () => openModal(headerInput.value));
  });

  closeButtons.forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  resultsContainer.addEventListener("mouseover", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-search-result-link]");
    if (!link) {
      return;
    }

    const index = Number.parseInt(link.dataset.resultIndex || "-1", 10);
    if (index >= 0) {
      setActiveIndex(index);
    }
  });

  resultsContainer.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>("[data-search-result-link]");
    if (!link) {
      return;
    }

    closeModal();
  });

  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    if (event.key === "ArrowDown") {
      if (renderedResults.length === 0) return;
      event.preventDefault();
      const next = activeIndex < renderedResults.length - 1 ? activeIndex + 1 : 0;
      setActiveIndex(next);
      return;
    }

    if (event.key === "ArrowUp") {
      if (renderedResults.length === 0) return;
      event.preventDefault();
      const next = activeIndex > 0 ? activeIndex - 1 : renderedResults.length - 1;
      setActiveIndex(next);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const target = renderedResults[activeIndex];
      if (!target) return;
      event.preventDefault();
      window.location.assign(target.url);
      return;
    }

    if (event.key === "Tab") {
      const focusables = getFocusableElements(panel);
      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement;

      if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openModal(headerInput.value);
      return;
    }

    if (event.key === "Escape") {
      closeModal();
    }
  });

  // Warm up the search index shortly after load.
  window.setTimeout(() => {
    loadIndex().catch(() => {
      // ignore warmup errors; rendering path handles them.
    });
  }, 1200);
};
