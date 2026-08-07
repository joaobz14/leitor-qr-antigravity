/**
 * Search & Highlight Utility - Antigravity Edition
 * Destaque visual de termos encontrados e busca inteligente
 */

export function highlightText(text, query) {
  if (!query || !query.trim() || !text) return escapeHTML(text);

  const safeText = escapeHTML(text);
  const safeQuery = escapeHTML(query.trim());
  const escapedRegexStr = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  try {
    const regex = new RegExp(`(${escapedRegexStr})`, 'gi');
    return safeText.replace(regex, '<mark class="highlight">$1</mark>');
  } catch (err) {
    return safeText;
  }
}


function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
