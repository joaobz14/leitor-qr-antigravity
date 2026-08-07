/**
 * Batch Selection & Thermal Label Generator - Antigravity Edition
 * Seleção em lote com suporte a impressoras térmicas (Zebra, Elgin, Argox) e Folha A4
 */

import { generateQRSvg } from './qr-view.js';

const selectedSkus = new Set();

export function toggleBatchProduct(productOrSku, isSelected) {
  const sku = typeof productOrSku === 'string' ? productOrSku : (productOrSku?.sku || '');
  if (!sku) return;

  if (isSelected) {
    selectedSkus.add(sku);
  } else {
    selectedSkus.delete(sku);
  }
  updateBatchBarUI();
}

export function clearBatchSelection() {
  selectedSkus.clear();
  updateBatchBarUI();
}

export function getSelectedCount() {
  return selectedSkus.size;
}

export function isSkuSelected(sku) {
  return selectedSkus.has(sku);
}

export function updateBatchBarUI() {
  const batchBar = document.getElementById("batch-bar");
  const countText = document.getElementById("batch-count-text");

  if (!batchBar || !countText) return;

  if (selectedSkus.size > 0) {
    countText.textContent = `${selectedSkus.size} item(ns) selecionado(s) para impressão`;
    batchBar.hidden = false;
    batchBar.style.display = "flex";
  } else {
    batchBar.hidden = true;
    batchBar.style.display = "none";
  }
}

export function printBatchLabels(allProducts, labelFormat = 'thermal-50x30') {
  const selectedProducts = allProducts.filter(p => selectedSkus.has(p.sku));
  if (selectedProducts.length === 0) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Permita pop-ups no navegador para gerar a folha de etiquetas.");
    return;
  }

  const isThermal100x150 = labelFormat === 'thermal-100x150';
  const isThermal50x30 = labelFormat === 'thermal-50x30';
  const isThermal100x50 = labelFormat === 'thermal-100x50';

  let cssStyles = `
    body { font-family: -apple-system, sans-serif; margin: 0; padding: 10px; color: #000; background: #fff; }
    .label-page { display: flex; flex-direction: column; gap: 12px; }
    .label-item { border: 1px solid #000; padding: 8px; display: flex; align-items: center; gap: 10px; page-break-inside: avoid; border-radius: 4px; }
    .label-qr svg { width: 70px; height: 70px; display: block; }
    .label-info h4 { margin: 0 0 3px 0; font-size: 13px; line-height: 1.2; }
    .label-info p { margin: 2px 0; font-size: 11px; }
  `;

  if (isThermal100x150) {
    cssStyles = `
      @page { size: 100mm 150mm; margin: 0; }
      body { margin: 0; padding: 5mm; width: 100mm; height: 150mm; box-sizing: border-box; font-family: sans-serif; }
      .label-page { display: block; }
      .label-item { border: 2px solid #000; border-radius: 8px; padding: 5mm; width: 90mm; height: 140mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; page-break-after: always; }
      .label-qr svg { width: 75mm; height: 75mm; margin-bottom: 4mm; }
      .label-info h4 { margin: 0 0 6px 0; font-size: 18px; font-weight: bold; line-height: 1.2; }
      .label-info p { margin: 4px 0; font-size: 14px; font-weight: 500; }
    `;
  } else if (isThermal50x30) {
    cssStyles = `
      @page { size: 50mm 30mm; margin: 0; }
      body { margin: 0; padding: 2mm; width: 50mm; height: 30mm; box-sizing: border-box; font-family: sans-serif; }
      .label-page { display: block; }
      .label-item { border: none; padding: 0; width: 46mm; height: 26mm; display: flex; align-items: center; justify-content: space-between; page-break-after: always; }
      .label-qr svg { width: 24mm; height: 24mm; }
      .label-info { width: 20mm; overflow: hidden; }
      .label-info h4 { margin: 0 0 2px 0; font-size: 9px; line-height: 1.1; word-break: break-word; }
      .label-info p { margin: 1px 0; font-size: 8px; }
    `;
  } else if (isThermal100x50) {
    cssStyles = `
      @page { size: 100mm 50mm; margin: 0; }
      body { margin: 0; padding: 4mm; width: 100mm; height: 50mm; box-sizing: border-box; font-family: sans-serif; }
      .label-page { display: block; }
      .label-item { border: none; padding: 0; width: 92mm; height: 42mm; display: flex; align-items: center; gap: 4mm; page-break-after: always; }
      .label-qr svg { width: 38mm; height: 38mm; }
      .label-info h4 { margin: 0 0 4px 0; font-size: 14px; }
      .label-info p { margin: 2px 0; font-size: 12px; }
    `;
  }


  const itemsHtml = selectedProducts.map(p => `
    <div class="label-item">
      <div class="label-qr">${generateQRSvg(p.qr_code_valor, 6, 1)}</div>
      <div class="label-info">
        <h4>${escapeHTML(p.nome)}</h4>
        <p><strong>SKU:</strong> ${escapeHTML(p.sku)}</p>
        ${p.variacao ? `<p><strong>Var:</strong> ${escapeHTML(p.variacao)}</p>` : ''}
        ${p.voltagem ? `<p><strong>Volt:</strong> ${escapeHTML(p.voltagem)}</p>` : ''}
      </div>
    </div>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Etiquetas Térmicas - Catálogo QR</title>
        <style>${cssStyles}</style>
      </head>
      <body>
        <div class="label-page">
          ${itemsHtml}
        </div>
        <script>
          window.onload = () => { window.print(); };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[match]);
}
