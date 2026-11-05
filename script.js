// ---------- Data loading ----------

async function loadCategories() {
    const response = await fetch("recipes/categories.json");
    const data = await response.json();
    return data.categories;
}

async function loadCategoryRecipes(category) {
    const response = await fetch(`recipes/${encodeURIComponent(category.toLowerCase())}/index.json`);
    const data = await response.json();
    return data.all_recipes;
}

async function loadRecipe(recipeName, category) {
    const response = await fetch(`recipes/${encodeURIComponent(category.toLowerCase())}/${encodeURIComponent(recipeName)}.json`);
    return response.json();
}

// ---------- Rendering ----------

function renderIngredient(item) {
    return `
        <li class="ingredient">
            <label>
                <input type="checkbox">
                <span class="checkbox-box" aria-hidden="true"></span>
                <span class="ingredient-text">${item}</span>
            </label>
        </li>
    `;
}

function renderRecipe(recipe) {
    return `
        <div class="recipe">
            <div class="recipe-header">
                <h3>${recipe.name}</h3>
                <span class="chevron" aria-hidden="true"></span>
            </div>
            <div class="recipe-body">
                ${recipe.description ? `<p class="recipe-description">${recipe.description}</p>` : ""}

                <h4>Koostisained</h4>
                <ul class="ingredients">
                    ${recipe.ingredients.map(renderIngredient).join("")}
                </ul>

                <h4>Sammud</h4>
                <ol class="instructions">
                    ${recipe.instructions.map(step => `<li>${step}</li>`).join("")}
                </ol>

                ${recipe.remarks.length > 0 ? `<h4>Märkused</h4>` : ""}
                <ol class="remarks">
                    ${recipe.remarks.map(remark => `<li>${remark}</li>`).join("")}
                </ol>
            </div>
        </div>
    `;
}

function renderCategory(category, recipes) {
    return `
        <div class="category" data-category="${escapeHTML(category)}">
            <div class="category-header">
                <h2>${category}</h2>
                <span class="chevron" aria-hidden="true"></span>
            </div>
            <div class="category-body">
                ${recipes.map(renderRecipe).join("")}
            </div>
        </div>
    `;
}

// ---------- Behavior ----------

function toggleDropdown(header) {
    const parent = header.parentElement;
    parent.classList.toggle("open");
    header.setAttribute("aria-expanded", parent.classList.contains("open"));
}

// Uses event delegation so listeners are never duplicated when
// recipes get re-rendered by applyFilters().
function wireEvents() {
    document.getElementById("categories").addEventListener("click", e => {
        const header = e.target.closest(".category-header, .recipe-header");
        if (header) toggleDropdown(header);
    });
}

// ---------- Search / ingredient filters ----------

let allRecipes = [];        // flat list of { recipe, category }
let activeFilters = new Set();  // lowercase ingredient substrings

function escapeHTML(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Collect all unique ingredients (lowercased) that any recipe contains
function collectAllIngredients(recipes) {
    const set = new Set();
    for (const { recipe } of recipes) {
        (recipe.ingredients || []).forEach(ing => set.add(ing.toLowerCase()));
    }
    return [...set].sort();
}

function matchCount(ingredient) {
    // how many recipes contain this ingredient (case-insensitive substring)
    const target = ingredient.toLowerCase();
    return allRecipes.filter(({ recipe }) =>
        (recipe.ingredients || []).some(ing => ing.toLowerCase().includes(target))
    ).length;
}

function renderSuggestions(query) {
    const list = document.getElementById("search-suggestions");
    const q = query.trim().toLowerCase();

    if (!q) {
        list.innerHTML = "";
        list.classList.remove("visible");
        return;
    }

    const matches = collectAllIngredients(allRecipes)
        .filter(ing => ing.includes(q) && !activeFilters.has(ing))
        .slice(0, 8);

    if (matches.length === 0) {
        list.innerHTML = `<li class="suggestion-empty">Ei leitud</li>`;
        list.classList.add("visible");
        return;
    }

    list.innerHTML = matches.map(ing => `
        <li class="suggestion" data-ingredient="${escapeHTML(ing)}">
            <span>${escapeHTML(ing)}</span>
            <span class="suggestion-count">${matchCount(ing)}</span>
        </li>
    `).join("");
    list.classList.add("visible");
}

function renderActiveFilters() {
    const container = document.getElementById("active-filters");
    container.innerHTML = [...activeFilters].map(ing => `
        <button class="filter-chip" data-ingredient="${escapeHTML(ing)}" title="Eemalda filter">
            ${escapeHTML(ing)}
            <span class="chip-remove" aria-hidden="true"></span>
        </button>
    `).join("");
}

function applyFilters() {
    document.querySelectorAll(".recipe").forEach(el => el.remove());

    const filters = [...activeFilters];
    const filtered = filters.length === 0
        ? allRecipes
        : allRecipes.filter(({ recipe }) => {
            const lowerIngredients = (recipe.ingredients || []).map(i => i.toLowerCase());
            return filters.every(f => lowerIngredients.some(ing => ing.includes(f)));
        });

    // Rebuild filtered recipes into their category bodies
    for (const { recipe, category } of filtered) {
        const catBody = document.querySelector(`.category[data-category="${CSS.escape(category)}"] .category-body`);
        if (catBody) catBody.insertAdjacentHTML("beforeend", renderRecipe(recipe));
    }

    // Hide categories with no matching recipes
    document.querySelectorAll(".category").forEach(cat => {
        const hasRecipes = cat.querySelector(".recipe") !== null;
        cat.style.display = hasRecipes ? "" : "none";
    });

    // Show a message if nothing matched
    const container = document.getElementById("categories");
    const emptyMsg = container.querySelector(".no-results");
    if (emptyMsg) emptyMsg.remove();
    if (filtered.length === 0) {
        container.insertAdjacentHTML("beforeend",
            `<p class="no-results">Ühtegi retsepti ei leitud nende koostisainetega.</p>`);
    }

    renderActiveFilters();
}

function setupSearch() {
    const input = document.getElementById("ingredient-search");
    const suggestions = document.getElementById("search-suggestions");

    input.addEventListener("input", () => renderSuggestions(input.value));
    input.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            input.value = "";
            renderSuggestions("");
            input.blur();
        }
    });

    // Hide suggestions when clicking outside
    document.addEventListener("click", e => {
        if (!document.getElementById("search-box").contains(e.target)) {
            suggestions.classList.remove("visible");
        }
    });

    // Click on a suggestion -> add filter
    suggestions.addEventListener("click", e => {
        const li = e.target.closest(".suggestion");
        if (!li) return;
        activeFilters.add(li.dataset.ingredient);
        input.value = "";
        renderSuggestions("");
        applyFilters();
        input.focus();
    });

    // Click on a filter chip -> remove filter
    document.getElementById("active-filters").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        activeFilters.delete(chip.dataset.ingredient);
        applyFilters();
    });
}

// ---------- Init ----------

async function renderPage() {
    const container = document.getElementById("categories");
    const categories = await loadCategories();

    const htmlParts = [];
    for (const category of categories) {
        const recipeNames = await loadCategoryRecipes(category);
        const recipes = [];
        for (const name of recipeNames) {
            const recipe = await loadRecipe(name, category);
            allRecipes.push({ recipe, category });
            recipes.push(recipe);
        }
        htmlParts.push(renderCategory(category, recipes));
    }

    container.innerHTML = htmlParts.join("");
    setupSearch();
    wireEvents();
}

renderPage();
