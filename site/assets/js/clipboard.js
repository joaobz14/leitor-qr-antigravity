/**
 * Clipboard & Toast Notification Engine - Antigravity Edition
 * Copia imagens de QR Code em 1-clique para a área de transferência do sistema
 */

import { generateQRSvg } from './qr-view.js';
import { playBeepSound } from './audio-feedback.js';

export async function copyQRImageToClipboard(product) {
  try {
    const svgString = generateQRSvg(product.qr_code_valor, 12, 4);
    const blob = await svgToPngBlob(svgString);

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      playBeepSound('copy');
      showToast(`QR Code de "${product.nome}" copiado! Cole no WhatsApp/Word.`);
    } else {
      // Fallback para navegadores sem suporte a ClipboardItem
      showToast("Cópia direta não suportada. Use o botão de download PNG.", "error");
    }
  } catch (err) {
    console.error("Erro ao copiar para clipboard:", err);
    showToast("Não foi possível copiar o QR Code.", "error");
  }
}

function svgToPngBlob(svgString) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 400;
      canvas.height = img.height || 400;
      const ctx = canvas.getContext("2d");

      // Fundo branco limpo
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (pngBlob) resolve(pngBlob);
        else reject(new Error("Falha ao converter SVG para PNG"));
      }, "image/png");
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

export function showToast(message, type = 'success') {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast-banner ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '📋' : '⚠️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
