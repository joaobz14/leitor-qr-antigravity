/**
 * Executive Inventory Dashboard - Antigravity Edition
 * Painel estatístico expansível para visão geral do estoque e métricas do catálogo
 */

import { getAllProducts, getCategories } from './catalog.js';

export function renderDashboard() {
  const container = document.getElementById("dashboard-container");
  if (!container) return;

  const products = getAllProducts();
  const categories = getCategories();
  
  const totalProducts = products.length;
  const totalCategories = categories.length;
  const withVariationCount = products.filter(p => p.variacao && p.variacao.trim()).length;
  const withVoltageCount = products.filter(p => p.voltagem && p.voltagem.trim()).length;

  container.innerHTML = `
    <details class="dashboard-details">
      <summary class="dashboard-summary">
        <div class="summary-content">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
          <span>Estatísticas e Métricas do Catálogo (${totalProducts} SKUs)</span>
        </div>
        <span class="chevron-icon">▼</span>
      </summary>

      <div class="dashboard-grid">
        <div class="stat-card">
          <span class="stat-label">Total de SKUs Ativos</span>
          <span class="stat-value">${totalProducts}</span>
          <span class="stat-sub">Produtos cadastrados</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Categorias</span>
          <span class="stat-value">${totalCategories}</span>
          <span class="stat-sub">Departamentos ativos</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Com Variações</span>
          <span class="stat-value">${withVariationCount}</span>
          <span class="stat-sub">Cores, tamanhos ou modelos</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Com Especificação Elétrica</span>
          <span class="stat-value">${withVoltageCount}</span>
          <span class="stat-sub">Voltagens cadastradas</span>
        </div>
      </div>
    </details>
  `;
}
