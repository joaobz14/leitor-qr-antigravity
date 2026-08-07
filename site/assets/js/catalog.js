/**
 * Catalog Manager - Antigravity Edition
 * Gerencia a lista de produtos, categorias e estado em memória
 */

let allProducts = [];
let activeCategory = "todas";

export function setCatalogProducts(products) {
  allProducts = products.filter(p => p.ativo !== false);
}

export function getAllProducts() {
  return allProducts;
}

export function getCategories() {
  const categoriesMap = new Map();
  
  allProducts.forEach(p => {
    const cat = p.categoria || "Geral";
    categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);
  });

  return Array.from(categoriesMap.entries()).map(([name, count]) => ({
    name,
    count
  }));
}

export function setActiveCategory(categoryName) {
  activeCategory = categoryName;
}

export function getActiveCategory() {
  return activeCategory;
}

export function filterProducts(query = "") {
  let filtered = allProducts;

  // Filtrar por Categoria
  if (activeCategory !== "todas") {
    filtered = filtered.filter(p => (p.categoria || "Geral").toLowerCase() === activeCategory.toLowerCase());
  }

  // Filtrar por Termo de Busca
  if (query.trim()) {
    const q = query.toLowerCase().trim();

    // REGRA DE MATCH EXATO DE SKU:
    // Se a busca for exatamente igual a um SKU existente (ex: "JL1"), exibe apenas o produto com SKU "JL1"
    const exactSkuMatches = filtered.filter(p => (p.sku || "").toLowerCase().trim() === q);
    if (exactSkuMatches.length > 0) {
      return exactSkuMatches;
    }

    // Se for uma busca parcial (ex: "JL"), busca em todos os campos normalmente
    filtered = filtered.filter(p => {
      const name = (p.nome || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      const variacao = (p.variacao || "").toLowerCase();
      const voltagem = (p.voltagem || "").toLowerCase();
      const qrVal = (p.qr_code_valor || "").toLowerCase();

      return name.includes(q) || sku.includes(q) || variacao.includes(q) || voltagem.includes(q) || qrVal.includes(q);
    });
  }

  return filtered;
}

