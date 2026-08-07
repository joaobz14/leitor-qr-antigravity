/**
 * Main Application Controller - Antigravity Edition
 */

import { decryptCatalogData } from './crypto.js';
import {
  setCatalogProducts,
  getAllProducts,
  getCategories,
  setActiveCategory,
  getActiveCategory,
  filterProducts
} from './catalog.js';
import { highlightText } from './search.js';
import { generateQRSvg, openQRModal } from './qr-view.js';
import { startCameraScanner, stopCameraScanner } from './camera-scanner.js';
import { toggleBatchProduct, clearBatchSelection, printBatchLabels, isSkuSelected } from './print-batch.js';
import { setupKeyboardShortcuts } from './shortcuts.js';
import { getRememberedPassphrase, saveRememberedPassphrase, clearRememberedPassphrase } from './storage.js';
import { playBeepSound } from './audio-feedback.js';
import { copyQRImageToClipboard } from './clipboard.js';
import { renderDashboard } from './dashboard.js';

// Registrar Service Worker para PWA / Funcionamento Offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW Error:', err));
  });
}

let encryptedCatalogData = null;


document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initApp();
});

function initTheme() {
  const toggleBtn = document.getElementById("theme-toggle");
  const currentTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", currentTheme);

  toggleBtn?.addEventListener("click", () => {
    const theme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });
}

async function initApp() {
  const lockedStatus = document.getElementById("locked-status");
  const unlockForm = document.getElementById("unlock-form");

  try {
    const response = await fetch("./data/catalogo.enc.json?t=" + Date.now(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Não foi possível carregar o arquivo criptografado (${response.status}).`);
    }


    encryptedCatalogData = await response.json();
    lockedStatus.textContent = "Catálogo carregado. Insira sua frase de acesso para desbloquear.";
    unlockForm.hidden = false;

    // Verificar se existe frase salva
    const savedPassphrase = getRememberedPassphrase();
    if (savedPassphrase) {
      attemptUnlock(savedPassphrase, true);
    }
  } catch (err) {
    console.error("Erro ao inicializar app:", err);
    lockedStatus.textContent = "Erro ao carregar os dados criptografados do catálogo.";
  }

  // Setup Form Submissão
  unlockForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const passphraseInput = document.getElementById("passphrase");
    const rememberKeyInput = document.getElementById("remember-key");

    if (passphraseInput) {
      attemptUnlock(passphraseInput.value.trim(), rememberKeyInput.checked);
    }
  });

  // Botão para limpar chave memorizada em navegadores mobile (Edge/Chrome/Safari)
  document.getElementById("btn-clear-memory")?.addEventListener("click", () => {
    clearRememberedPassphrase();
    localStorage.clear();
    sessionStorage.clear();
    const passInput = document.getElementById("passphrase");
    if (passInput) passInput.value = "";
    showMessage("Memória memorizada limpa! Digite sua nova senha.", "success");
  });

  // Toggle visibilidade da senha
  document.getElementById("btn-toggle-password")?.addEventListener("click", () => {
    const input = document.getElementById("passphrase");
    if (input) {
      input.type = input.type === "password" ? "text" : "password";
    }
  });

  // Modal de Compartilhamento do App (QR Code para abrir em outro celular)
  const shareBtn = document.getElementById("btn-share-app");
  const shareModal = document.getElementById("share-modal");
  const closeShareBtn = document.getElementById("close-share-modal");
  const shareQrDisplay = document.getElementById("share-qr-display");
  const shareUrlText = document.getElementById("share-url-text");

  shareBtn?.addEventListener("click", () => {
    const currentUrl = window.location.href.includes("github.io") 
      ? window.location.href 
      : "https://joaobz14.github.io/leitor-qr-antigravity/";

    if (shareQrDisplay && typeof generateQRCodeSVG === "function") {
      shareQrDisplay.innerHTML = generateQRCodeSVG(currentUrl);
    }
    if (shareUrlText) {
      shareUrlText.textContent = currentUrl;
    }
    if (typeof shareModal?.showModal === "function") {
      shareModal.showModal();
    }
  });

  closeShareBtn?.addEventListener("click", () => {
    shareModal?.close();
  });



  // Setup de Busca
  const searchInput = document.getElementById("search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");

  searchInput?.addEventListener("input", (e) => {
    const val = e.target.value;
    clearSearchBtn.hidden = !val;
    renderProducts();
  });

  clearSearchBtn?.addEventListener("click", () => {
    if (searchInput) {
      searchInput.value = "";
      clearSearchBtn.hidden = true;
      renderProducts();
    }
  });

  // Setup Botão Bloquear
  document.getElementById("lock-button")?.addEventListener("click", lockCatalog);

  // Setup Scanner de Câmera
  document.getElementById("btn-open-camera")?.addEventListener("click", () => {
    startCameraScanner((scannedValue) => {
      playBeepSound('success');
      if (searchInput) {
        searchInput.value = scannedValue;
        clearSearchBtn.hidden = false;
        renderProducts();
      }
    });
  });

  document.getElementById("close-camera-modal")?.addEventListener("click", stopCameraScanner);
  document.getElementById("close-qr-modal")?.addEventListener("click", () => {
    document.getElementById("qr-modal")?.close();
  });

  // Fechar modais ao clicar no backdrop escuro
  [document.getElementById("qr-modal"), document.getElementById("camera-modal")].forEach(dialog => {
    dialog?.addEventListener("click", (e) => {
      if (e.target === dialog) {
        dialog.close();
        if (dialog.id === "camera-modal") stopCameraScanner();
      }
    });
  });

  // Setup Batch Print com Formato Térmico
  document.getElementById("btn-print-batch")?.addEventListener("click", () => {
    const formatSelect = document.getElementById("batch-label-format");
    const format = formatSelect ? formatSelect.value : 'thermal-50x30';
    printBatchLabels(getAllProducts(), format);
  });

  const clearBatchHandler = () => {
    clearBatchSelection();
    renderProducts();
  };

  document.getElementById("btn-clear-batch")?.addEventListener("click", clearBatchHandler);
  document.getElementById("close-batch-bar")?.addEventListener("click", clearBatchHandler);




  // Setup Atalhos de Teclado
  setupKeyboardShortcuts(
    () => searchInput?.focus(),
    () => {
      document.getElementById("qr-modal")?.close();
      stopCameraScanner();
      if (searchInput && searchInput.value) {
        searchInput.value = "";
        clearSearchBtn.hidden = true;
        renderProducts();
      }
    },
    lockCatalog
  );
}

async function attemptUnlock(passphrase, rememberKey) {
  const messageBanner = document.getElementById("unlock-message");
  const unlockBtn = document.getElementById("unlock-button");

  if (!passphrase || passphrase.length < 16) {
    showMessage("A frase de acesso deve conter no mínimo 16 caracteres.", "error");
    return;
  }

  try {
    unlockBtn.disabled = true;
    unlockBtn.textContent = "Descriptografando...";
    showMessage("Processando criptografia AES-GCM no cliente...", "info");

    const decrypted = await decryptCatalogData(encryptedCatalogData, passphrase);
    
    if (decrypted && decrypted.products) {
      setCatalogProducts(decrypted.products);
      
      if (rememberKey) {
        saveRememberedPassphrase(passphrase);
      } else {
        clearRememberedPassphrase();
      }

      showCatalogScreen();
    } else {
      throw new Error("Estrutura do catálogo descriptografado inválida.");
    }
  } catch (err) {
    console.error("Falha ao desbloquear:", err);
    showMessage("Frase de acesso incorreta ou falha na descriptografia.", "error");
    clearRememberedPassphrase();
    const passInput = document.getElementById("passphrase");
    if (passInput) {
      passInput.value = "";
      passInput.focus();
    }
  } finally {

    unlockBtn.disabled = false;
    unlockBtn.textContent = "Desbloquear Catálogo";
  }
}

function showMessage(text, type) {
  const banner = document.getElementById("unlock-message");
  if (!banner) return;

  banner.hidden = false;
  banner.className = `status-banner ${type}`;
  banner.textContent = text;
}

function showCatalogScreen() {
  document.getElementById("locked-screen").hidden = true;
  document.getElementById("catalog-screen").hidden = false;
  document.getElementById("btn-open-camera").hidden = false;
  document.getElementById("lock-button").hidden = false;

  renderDashboard();
  renderCategoryPills();
  renderProducts();
}

function lockCatalog() {
  document.getElementById("locked-screen").hidden = false;
  document.getElementById("catalog-screen").hidden = true;
  document.getElementById("btn-open-camera").hidden = true;
  document.getElementById("lock-button").hidden = true;
  
  clearRememberedPassphrase();
  setCatalogProducts([]);
}

function renderCategoryPills() {
  const pillsBar = document.getElementById("category-pills");
  if (!pillsBar) return;

  const categories = getCategories();
  const currentActive = getActiveCategory();

  let html = `<button class="category-pill ${currentActive === 'todas' ? 'active' : ''}" data-cat="todas">Todas (${getAllProducts().length})</button>`;
  
  categories.forEach(cat => {
    html += `<button class="category-pill ${currentActive === cat.name ? 'active' : ''}" data-cat="${cat.name}">${escapeHTML(cat.name)} (${cat.count})</button>`;
  });

  pillsBar.innerHTML = html;

  pillsBar.querySelectorAll(".category-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveCategory(btn.dataset.cat);
      renderCategoryPills();
      renderProducts();
    });
  });
}

function renderProducts() {
  const grid = document.getElementById("products-grid");
  const emptyState = document.getElementById("empty-state");
  const countMeta = document.getElementById("catalog-count-meta");
  const searchInput = document.getElementById("search-input");

  if (!grid) return;

  const query = searchInput?.value || "";
  const products = filterProducts(query);

  if (countMeta) {
    countMeta.textContent = `Exibindo ${products.length} de ${getAllProducts().length} produtos no catálogo`;
  }

  if (products.length === 0) {
    grid.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  grid.innerHTML = products.map(product => {
    const highlightedName = highlightText(product.nome, query);
    const highlightedSku = highlightText(product.sku, query);
    const qrSvg = generateQRSvg(product.qr_code_valor, 3, 1);

    return `
      <article class="product-card">
        <div class="product-header">
          <span class="product-category-tag">${escapeHTML(product.categoria || 'Geral')}</span>
          <label class="checkbox-container">
            <input type="checkbox" class="batch-select-checkbox" data-sku="${product.sku}" ${isSkuSelected(product.sku) ? 'checked' : ''}>
            <span class="checkmark"></span>
          </label>
        </div>

        <h3 class="product-name">${highlightedName}</h3>

        <div class="product-specs">
          <span class="spec-badge">SKU: ${highlightedSku}</span>
          ${product.variacao ? `<span class="spec-badge">Var: ${escapeHTML(product.variacao)}</span>` : ''}
          ${product.voltagem ? `<span class="spec-badge">${escapeHTML(product.voltagem)}</span>` : ''}
        </div>

        <div class="qr-thumb-container" data-sku="${product.sku}" title="Clique para expandir em HD">
          ${qrSvg}
        </div>

        <div class="product-card-actions">
          <button class="secondary-button btn-card-action btn-copy-qr" data-sku="${product.sku}" type="button">
            📋 Copiar QR
          </button>
        </div>
      </article>
    `;
  }).join('');

  // Listeners para abrir modal do QR Code
  grid.querySelectorAll(".qr-thumb-container").forEach(thumb => {
    thumb.addEventListener("click", () => {
      const sku = thumb.dataset.sku;
      const product = getAllProducts().find(p => p.sku === sku);
      if (product) openQRModal(product);
    });
  });

  // Listeners para copiar QR Code
  grid.querySelectorAll(".btn-copy-qr").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const sku = btn.dataset.sku;
      const product = getAllProducts().find(p => p.sku === sku);
      if (product) copyQRImageToClipboard(product);
    });
  });

  // Listeners para seleção em lote
  grid.querySelectorAll(".batch-select-checkbox").forEach(cb => {
    cb.addEventListener("change", (e) => {
      const sku = cb.dataset.sku;
      if (sku) toggleBatchProduct(sku, e.target.checked);
    });
  });
}


function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[match]);
}
