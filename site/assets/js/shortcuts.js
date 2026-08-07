/**
 * Keyboard Shortcuts Manager - Antigravity Edition
 * Gerencia atalhos de teclado (Ctrl+K, Esc, Alt+L)
 */

export function setupKeyboardShortcuts(onFocusSearch, onCloseModals, onLockCatalog) {
  document.addEventListener("keydown", (e) => {
    // Ctrl + K ou Cmd + K -> Foco na busca
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      onFocusSearch();
    }

    // Esc -> Fechar Modais / Limpar busca
    if (e.key === "Escape") {
      onCloseModals();
    }

    // Alt + L -> Bloquear catálogo
    if (e.altKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      onLockCatalog();
    }
  });
}
