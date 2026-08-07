/**
 * Local Storage & Session State Manager - Antigravity Edition
 */

const STORAGE_KEY = "antigravity_qr_remembered_passphrase";

export function getRememberedPassphrase() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

export function saveRememberedPassphrase(passphrase) {
  try {
    localStorage.setItem(STORAGE_KEY, passphrase);
  } catch (err) {
    console.error("Não foi possível salvar a frase no localStorage:", err);
  }
}

export function clearRememberedPassphrase() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Erro ao remover frase do localStorage:", err);
  }
}
