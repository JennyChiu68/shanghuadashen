const statusEl = document.getElementById('status');
const groupsEl = document.getElementById('groups');
const metaProgressEl = document.getElementById('meta-progress');
const metaStatsEl = document.getElementById('meta-stats');
const metaSummaryEl = document.getElementById('meta-filter-summary');
const emptyEl = document.getElementById('empty');
const filterFilledEl = document.getElementById('filter-filled');
const filterAliasEl = document.getElementById('filter-alias');
const filterMeaningEl = document.getElementById('filter-meaning');
const filterSeasonEl = document.getElementById('filter-season');
const searchNameEl = document.getElementById('search-name');
const filterGroupEl = document.getElementById('filter-group');
const filterTierEl = document.getElementById('filter-tier');
const sortOrderEl = document.getElementById('sort-order');
const resetFiltersEl = document.getElementById('reset-filters');
const clearSearchEl = document.getElementById('clear-search');

let allFlowers = [];
let currentKeyword = '';
const STORAGE_KEY = 'flower-list-filters';

function groupByGroup(flowers) {
  const grouped = new Map();
  flowers.forEach((flower) => {
    const key = String(flower.group ?? '未知');
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(flower);
  });
  return grouped;
}

function renderGroup(groupId, flowers) {
  const group = document.createElement('article');
  group.className = 'group';

  const title = document.createElement('h2');
  title.className = 'group__title';
  title.textContent = `第 ${groupId} 组`;

  const tier = document.createElement('span');
  tier.className = 'group__tier';
  tier.textContent = flowers[0]?.tier ?? '未知等级';

  title.appendChild(tier);
  group.appendChild(title);

  const list = document.createElement('div');
  list.className = 'flower-list';

  sortGroupFlowers(flowers).forEach((flower) => {
    const card = document.createElement('div');
    card.className = 'flower-card';

    const name = document.createElement('div');
    name.className = 'flower-card__name';
    appendHighlightedText(name, flower.name ?? '未命名', currentKeyword);

    const note = document.createElement('div');
    note.className = 'flower-card__note';
    note.textContent = flower.image_url ? '图片已准备' : '图片待补充';

    const meta = document.createElement('div');
    meta.className = 'flower-card__meta';

    const alias = Array.isArray(flower.alias) && flower.alias.length
      ? flower.alias.join(' / ')
      : '待补充';
    const meaning = flower.meaning?.trim() || '待补充';
    const season = flower.season?.trim() || '待补充';

    meta.appendChild(createMetaLine('别名', alias, currentKeyword));
    meta.appendChild(createMetaLine('花语', meaning, currentKeyword));
    meta.appendChild(createMetaLine('季节', season, currentKeyword));

    card.appendChild(name);
    card.appendChild(note);
    card.appendChild(meta);
    list.appendChild(card);
  });

  group.appendChild(list);
  return group;
}

function createMetaLine(label, value, keyword) {
  const line = document.createElement('div');
  line.className = 'flower-card__meta-line';

  const labelEl = document.createElement('span');
  labelEl.className = 'flower-card__meta-label';
  labelEl.textContent = `${label}：`;

  const valueEl = document.createElement('span');
  valueEl.className = 'flower-card__meta-value';
  appendHighlightedText(valueEl, value, keyword);

  line.appendChild(labelEl);
  line.appendChild(valueEl);
  return line;
}

function appendHighlightedText(container, text, keyword) {
  const content = text ?? '';
  const highlight = keyword.trim();
  if (!highlight) {
    container.textContent = content;
    return;
  }

  const regex = new RegExp(escapeRegExp(highlight), 'gi');
  const parts = content.split(regex);
  const matches = content.match(regex);

  if (!matches) {
    container.textContent = content;
    return;
  }

  container.textContent = '';
  parts.forEach((part, index) => {
    if (part) {
      container.append(document.createTextNode(part));
    }
    if (matches[index]) {
      const mark = document.createElement('span');
      mark.className = 'highlight';
      mark.textContent = matches[index];
      container.append(mark);
    }
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function mergeFlowerMeta(flowers, metas) {
  const metaMap = new Map();
  metas.forEach((meta) => {
    if (meta?.name) {
      metaMap.set(meta.name, meta);
    }
  });

  return flowers.map((flower) => {
    const meta = metaMap.get(flower.name);
    return {
      ...flower,
      alias: meta?.alias ?? [],
      meaning: meta?.meaning ?? '',
      season: meta?.season ?? '',
    };
  });
}

function hasMeta(flower) {
  return (
    (Array.isArray(flower.alias) && flower.alias.length > 0)
    || (flower.meaning && flower.meaning.trim() !== '')
    || (flower.season && flower.season.trim() !== '')
  );
}

function renderFlowers(flowers) {
  const grouped = groupByGroup(flowers);
  groupsEl.innerHTML = '';
  grouped.forEach((items, groupId) => {
    groupsEl.appendChild(renderGroup(groupId, items));
  });
  groupsEl.hidden = false;
}

function updateMetaProgress(flowers) {
  const filledCount = flowers.filter(hasMeta).length;
  const remainingCount = flowers.length - filledCount;
  metaProgressEl.textContent = `元信息完成度：${filledCount}/${flowers.length}`;
  metaStatsEl.textContent = `已补充：${filledCount}，待补充：${remainingCount}`;
}

function matchesKeyword(flower, keyword) {
  if (!keyword) {
    return true;
  }
  const nameMatch = (flower.name ?? '').includes(keyword);
  const aliasMatch = Array.isArray(flower.alias)
    && flower.alias.some((alias) => (alias ?? '').includes(keyword));
  const meaningMatch = (flower.meaning ?? '').includes(keyword);
  const seasonMatch = (flower.season ?? '').includes(keyword);
  const tierMatch = (flower.tier ?? '').includes(keyword);
  const groupMatch = String(flower.group ?? '').includes(keyword);
  return nameMatch || aliasMatch || meaningMatch || seasonMatch || tierMatch || groupMatch;
}

function updateFilterSummary(keyword, onlyFilled, order) {
  const parts = [];
  if (keyword) {
    parts.push(`关键词“${keyword}”`);
  }
  if (filterGroupEl.value !== 'all') {
    parts.push(`第 ${filterGroupEl.value} 组`);
  }
  if (filterTierEl.value !== 'all') {
    parts.push(filterTierEl.value);
  }
  if (onlyFilled) {
    parts.push('仅已补充');
  }
  if (filterAliasEl.checked) {
    parts.push('含别名');
  }
  if (filterMeaningEl.checked) {
    parts.push('含花语');
  }
  if (filterSeasonEl.checked) {
    parts.push('含季节');
  }
  if (order === 'name') {
    parts.push('按花名排序');
  } else if (order === 'filled') {
    parts.push('已补充优先');
  }
  metaSummaryEl.textContent = parts.length ? `当前筛选：${parts.join('，')}` : '当前筛选：全部';
}

function sortGroupFlowers(flowers) {
  const order = sortOrderEl.value;
  if (order === 'name') {
    return [...flowers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }
  if (order === 'filled') {
    return [...flowers].sort((a, b) => {
      const aFilled = hasMeta(a);
      const bFilled = hasMeta(b);
      if (aFilled === bFilled) {
        return (a.name ?? '').localeCompare(b.name ?? '');
      }
      return aFilled ? -1 : 1;
    });
  }
  return flowers;
}

function applyFilters() {
  const onlyFilled = filterFilledEl.checked;
  const keyword = searchNameEl.value.trim();
  const order = sortOrderEl.value;
  const groupValue = filterGroupEl.value;
  const tierValue = filterTierEl.value;
  const aliasOnly = filterAliasEl.checked;
  const meaningOnly = filterMeaningEl.checked;
  const seasonOnly = filterSeasonEl.checked;
  currentKeyword = keyword;
  saveFilters({
    keyword,
    onlyFilled,
    aliasOnly,
    meaningOnly,
    seasonOnly,
    groupValue,
    tierValue,
    order,
  });
  const filteredFlowers = allFlowers
    .filter((flower) => (!onlyFilled || hasMeta(flower)))
    .filter((flower) => (groupValue === 'all' || String(flower.group) === groupValue))
    .filter((flower) => (tierValue === 'all' || flower.tier === tierValue))
    .filter((flower) => (!aliasOnly || (flower.alias ?? []).length > 0))
    .filter((flower) => (!meaningOnly || (flower.meaning ?? '').trim() !== ''))
    .filter((flower) => (!seasonOnly || (flower.season ?? '').trim() !== ''))
    .filter((flower) => matchesKeyword(flower, keyword));

  updateFilterSummary(keyword, onlyFilled, order);
  statusEl.textContent = `已显示 ${filteredFlowers.length} / ${allFlowers.length} 个花名。`;
  if (filteredFlowers.length === 0) {
    emptyEl.hidden = false;
    groupsEl.hidden = true;
  } else {
    emptyEl.hidden = true;
    renderFlowers(filteredFlowers);
  }
}

function saveFilters(filters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch (error) {
    // ignore storage failures
  }
}

function loadFilters() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch (error) {
    return null;
  }
}

function applySavedFilters(filters) {
  if (!filters) {
    return;
  }
  searchNameEl.value = filters.keyword ?? '';
  filterFilledEl.checked = Boolean(filters.onlyFilled);
  filterAliasEl.checked = Boolean(filters.aliasOnly);
  filterMeaningEl.checked = Boolean(filters.meaningOnly);
  filterSeasonEl.checked = Boolean(filters.seasonOnly);
  filterGroupEl.value = filterGroupEl.querySelector(`[value="${filters.groupValue}"]`)
    ? filters.groupValue
    : 'all';
  filterTierEl.value = filterTierEl.querySelector(`[value="${filters.tierValue}"]`)
    ? filters.tierValue
    : 'all';
  sortOrderEl.value = filters.order ?? 'default';
}

function populateFilterOptions(flowers) {
  const groups = Array.from(new Set(flowers.map((flower) => String(flower.group)))).sort(
    (a, b) => Number(a) - Number(b),
  );
  const tiers = Array.from(new Set(flowers.map((flower) => flower.tier))).filter(Boolean);

  filterGroupEl.innerHTML = '<option value="all">全部</option>';
  groups.forEach((group) => {
    const option = document.createElement('option');
    option.value = group;
    option.textContent = `第 ${group} 组`;
    filterGroupEl.appendChild(option);
  });

  filterTierEl.innerHTML = '<option value="all">全部</option>';
  tiers.forEach((tier) => {
    const option = document.createElement('option');
    option.value = tier;
    option.textContent = tier;
    filterTierEl.appendChild(option);
  });
}

async function loadFlowers() {
  try {
    const [flowersResponse, metaResponse] = await Promise.all([
      fetch('../data/flowers.json'),
      fetch('../data/flower_meta.json'),
    ]);
    if (!flowersResponse.ok) {
      throw new Error(`数据请求失败 (${flowersResponse.status})`);
    }
    const flowers = await flowersResponse.json();
    const metas = metaResponse.ok ? await metaResponse.json() : [];
    allFlowers = mergeFlowerMeta(flowers, metas);
    populateFilterOptions(allFlowers);
    applySavedFilters(loadFilters());
    updateMetaProgress(allFlowers);
    applyFilters();
  } catch (error) {
    statusEl.textContent = `加载失败：${error.message}`;
  }
}

loadFlowers();

filterFilledEl.addEventListener('change', () => {
  applyFilters();
});

filterAliasEl.addEventListener('change', () => {
  applyFilters();
});

filterMeaningEl.addEventListener('change', () => {
  applyFilters();
});

filterSeasonEl.addEventListener('change', () => {
  applyFilters();
});

searchNameEl.addEventListener('input', () => {
  applyFilters();
});

sortOrderEl.addEventListener('change', () => {
  applyFilters();
});

filterGroupEl.addEventListener('change', () => {
  applyFilters();
});

filterTierEl.addEventListener('change', () => {
  applyFilters();
});

resetFiltersEl.addEventListener('click', () => {
  searchNameEl.value = '';
  filterFilledEl.checked = false;
  filterAliasEl.checked = false;
  filterMeaningEl.checked = false;
  filterSeasonEl.checked = false;
  filterGroupEl.value = 'all';
  filterTierEl.value = 'all';
  sortOrderEl.value = 'default';
  applyFilters();
  searchNameEl.focus();
});

clearSearchEl.addEventListener('click', () => {
  searchNameEl.value = '';
  applyFilters();
  searchNameEl.focus();
});
