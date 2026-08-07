/**
 * Real-Time Camera QR Scanner - Antigravity Edition
 * Leitura de QR Code via Câmera com busca automática no catálogo
 */

let videoStream = null;
let animationFrameId = null;

export async function startCameraScanner(onScanSuccess) {
  const modal = document.getElementById("camera-modal");
  const video = document.getElementById("camera-video");
  const statusText = document.getElementById("camera-status");

  if (!modal || !video) return;

  modal.showModal();

  try {
    statusText.textContent = "Acessando a câmera do dispositivo...";
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    video.srcObject = videoStream;
    await video.play();
    statusText.textContent = "Posicione o QR Code no centro da área marcada...";

    // Usar BarcodeDetector nativo se disponível no navegador
    if ("BarcodeDetector" in window) {
      const barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
      
      const scanLoop = async () => {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            const barcodes = await barcodeDetector.detect(video);
            if (barcodes.length > 0) {
              const scannedValue = barcodes[0].rawValue;
              stopCameraScanner();
              onScanSuccess(scannedValue);
              return;
            }
          } catch (err) {
            console.error("Erro na detecção de código:", err);
          }
        }
        animationFrameId = requestAnimationFrame(scanLoop);
      };
      
      animationFrameId = requestAnimationFrame(scanLoop);
    } else {
      statusText.textContent = "Detecção de QR por câmera não suportada nativamente neste navegador.";
    }

  } catch (err) {
    console.error("Erro ao acessar câmera:", err);
    statusText.textContent = "Não foi possível acessar a câmera. Verifique as permissões.";
  }
}

export function stopCameraScanner() {
  const modal = document.getElementById("camera-modal");
  if (modal && modal.open) {
    modal.close();
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
}
