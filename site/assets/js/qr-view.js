/**
 * QR Code Generator & Renderer - Antigravity Edition
 * Suporte a miniaturas, modal HD, paletas de cores, download e projeção
 */

export function generateQRSvg(text, cellSize = 4, margin = 2) {
  if (!window.qrcode) {
    return `<div class="qr-error">Biblioteca QR não carregada</div>`;
  }

  try {
    const typeNumber = 0; // Detecção automática
    const errorCorrectionLevel = 'M';
    const qr = window.qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(text);
    qr.make();

    return qr.createSvgTag(cellSize, margin);
  } catch (err) {
    console.error("Erro ao gerar QR Code:", err);
    return `<div class="qr-error">Erro QR</div>`;
  }
}

export function openQRModal(product) {
  const modal = document.getElementById("qr-modal");
  const modalBody = document.getElementById("qr-modal-body");

  if (!modal || !modalBody) return;

  const qrSvg = generateQRSvg(product.qr_code_valor, 8, 4);

  modalBody.innerHTML = `
    <div class="qr-detail-card">
      <div class="qr-detail-header">
        <span class="product-category-tag">${escapeHTML(product.categoria || 'Geral')}</span>
        <h3>${escapeHTML(product.nome)}</h3>
        <p class="supporting-text">SKU: <strong>${escapeHTML(product.sku)}</strong></p>
      </div>

      <div id="qr-hd-wrapper" class="qr-hd-display">
        ${qrSvg}
      </div>

      <div class="qr-code-raw-value">
        <span>Conteúdo do QR:</span>
        <code>${escapeHTML(product.qr_code_valor)}</code>
      </div>

      <div class="qr-modal-actions">
        <button id="btn-download-png" class="primary-button glossy-btn" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Baixar PNG
        </button>
        
        <button id="btn-project-mode" class="secondary-button" type="button">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          Modo Projeção
        </button>
      </div>
    </div>
  `;

  modal.showModal();

  // Listener para Download PNG
  document.getElementById("btn-download-png")?.addEventListener("click", () => {
    downloadQRPng(product.sku, product.qr_code_valor);
  });

  // Listener para Modo Projeção
  document.getElementById("btn-project-mode")?.addEventListener("click", () => {
    const wrapper = document.getElementById("qr-hd-wrapper");
    if (wrapper) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        wrapper.requestFullscreen().catch(err => console.error(err));
      }
    }
  });
}

function downloadQRPng(sku, text) {
  const svgString = generateQRSvg(text, 12, 4);
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width || 400;
    canvas.height = img.height || 400;
    const ctx = canvas.getContext("2d");
    
    // Fundo branco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qrcode-${sku}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[match]);
}
