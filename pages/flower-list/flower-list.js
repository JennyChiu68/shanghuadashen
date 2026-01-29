const STORAGE_KEY = 'flower-list-filters';

const sortOptions = [
  { label: '按原顺序', value: 'default' },
  { label: '按花名', value: 'name' },
  { label: '已补充优先', value: 'filled' },
];

Page({
  data: {
    statusText: '加载中…',
    metaProgressText: '元信息完成度：计算中…',
    metaStatsText: '已补充：0，待补充：0',
    metaSummaryText: '当前筛选：全部',
    emptyVisible: false,
    groups: [],
    totalCount: 0,
    filteredCount: 0,
    keyword: '',
    onlyFilled: false,
    aliasOnly: false,
    meaningOnly: false,
    seasonOnly: false,
    seasonFilter: 'all',
    groupOptions: ['全部'],
    groupValues: ['all'],
    groupIndex: 0,
    tierOptions: ['全部'],
    tierValues: ['all'],
    tierIndex: 0,
    sortOptions: sortOptions.map((item) => item.label),
    sortValues: sortOptions.map((item) => item.value),
    sortIndex: 0,
  },
  onLoad() {
    const flowers = require('../../data/flowers.json');
    const metas = require('../../data/flower_meta.json');
    const merged = this.mergeFlowerMeta(flowers, metas);
    const { groupOptions, groupValues, tierOptions, tierValues } = this.buildFilters(merged);
    this.allFlowers = merged;
    this.setData({
      groupOptions,
      groupValues,
      tierOptions,
      tierValues,
    });
    this.applySavedFilters();
    this.updateMetaProgress(merged);
    this.applyFilters();
  },
  mergeFlowerMeta(flowers, metas) {
    const metaMap = new Map();
    metas.forEach((meta) => {
      if (meta && meta.name) {
        metaMap.set(meta.name, meta);
      }
    });
    return flowers.map((flower) => {
      const meta = metaMap.get(flower.name) || {};
      const alias = meta.alias || [];
      const meaning = meta.meaning || '';
      const season = meta.season || '';
      return {
        ...flower,
        alias,
        meaning,
        season,
        pinyin: meta.pinyin || '',
        pinyinInitials: meta.pinyinInitials || '',
      };
    });
  },
  buildFilters(flowers) {
    const groups = Array.from(new Set(flowers.map((flower) => String(flower.group)))).sort(
      (a, b) => Number(a) - Number(b),
    );
    const tiers = Array.from(new Set(flowers.map((flower) => flower.tier))).filter(Boolean);
    return {
      groupOptions: ['全部', ...groups.map((group) => `第 ${group} 组`)],
      groupValues: ['all', ...groups],
      tierOptions: ['全部', ...tiers],
      tierValues: ['all', ...tiers],
    };
  },
  updateMetaProgress(flowers) {
    const filledCount = flowers.filter(this.hasMeta).length;
    const remainingCount = flowers.length - filledCount;
    this.setData({
      metaProgressText: `元信息完成度：${filledCount}/${flowers.length}`,
      metaStatsText: `已补充：${filledCount}，待补充：${remainingCount}`,
    });
  },
  hasMeta(flower) {
    return (
      (Array.isArray(flower.alias) && flower.alias.length > 0)
      || (flower.meaning && flower.meaning.trim() !== '')
      || (flower.season && flower.season.trim() !== '')
    );
  },
  applyFilters() {
    const keyword = this.data.keyword.trim();
    const groupValue = this.data.groupValues[this.data.groupIndex];
    const tierValue = this.data.tierValues[this.data.tierIndex];
    const order = this.data.sortValues[this.data.sortIndex];
    const filteredFlowers = this.allFlowers
      .filter((flower) => (!this.data.onlyFilled || this.hasMeta(flower)))
      .filter((flower) => (groupValue === 'all' || String(flower.group) === groupValue))
      .filter((flower) => (tierValue === 'all' || flower.tier === tierValue))
      .filter((flower) => (!this.data.aliasOnly || (flower.alias || []).length > 0))
      .filter((flower) => (!this.data.meaningOnly || (flower.meaning || '').trim() !== ''))
      .filter((flower) => (!this.data.seasonOnly || (flower.season || '').trim() !== ''))
      .filter((flower) => this.matchesSeasonFilter(flower, this.data.seasonFilter))
      .filter((flower) => this.matchesKeyword(flower, keyword));

    const groups = this.groupAndDecorate(filteredFlowers, keyword, order);
    this.updateFilterSummary(keyword, order);
    this.setData({
      groups,
      emptyVisible: filteredFlowers.length === 0,
      totalCount: this.allFlowers.length,
      filteredCount: filteredFlowers.length,
      statusText: `已显示 ${filteredFlowers.length} / ${this.allFlowers.length} 个花名。`,
    });
    this.saveFilters();
  },
  matchesKeyword(flower, keyword) {
    const normalizedKeyword = this.normalizeSearchTerm(keyword);
    if (!normalizedKeyword) {
      return true;
    }
    const tokens = [
      flower.name,
      flower.meaning,
      flower.season,
      flower.tier,
      String(flower.group || ''),
      flower.pinyin,
      flower.pinyinInitials,
      ...(flower.alias || []),
    ];
    return tokens.some((token) => this.normalizeSearchTerm(token).includes(normalizedKeyword));
  },
  normalizeSearchTerm(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, '');
  },
  matchesSeasonFilter(flower, seasonFilter) {
    if (!seasonFilter || seasonFilter === 'all') {
      return true;
    }
    const seasonText = (flower.season || '').trim();
    return seasonText.includes(seasonFilter);
  },
  groupAndDecorate(flowers, keyword, order) {
    const grouped = new Map();
    flowers.forEach((flower) => {
      const key = String(flower.group || '未知');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(flower);
    });

    const groups = [];
    grouped.forEach((items, groupId) => {
      const sortedItems = this.sortGroupFlowers(items, order);
      groups.push({
        groupId,
        tier: sortedItems[0] ? sortedItems[0].tier : '未知等级',
        flowers: sortedItems.map((flower) => this.decorateFlower(flower, keyword)),
      });
    });
    return groups;
  },
  decorateFlower(flower, keyword) {
    const aliasText = Array.isArray(flower.alias) && flower.alias.length
      ? flower.alias.join(' / ')
      : '待补充';
    const meaningText = flower.meaning && flower.meaning.trim() ? flower.meaning : '待补充';
    const seasonText = flower.season && flower.season.trim() ? flower.season : '待补充';
    return {
      ...flower,
      nameHighlight: this.highlightText(flower.name || '未命名', keyword),
      aliasHighlight: this.highlightText(aliasText, keyword),
      meaningHighlight: this.highlightText(meaningText, keyword),
      seasonHighlight: this.highlightText(seasonText, keyword),
      imageNote: flower.image_url ? '图片已准备' : '图片待补充',
    };
  },
  highlightText(text, keyword) {
    const highlight = keyword.trim();
    if (!highlight) {
      return [{ text, highlight: false }];
    }
    const regex = new RegExp(this.escapeRegExp(highlight), 'gi');
    const parts = text.split(regex);
    const matches = text.match(regex);
    if (!matches) {
      return [{ text, highlight: false }];
    }
    const result = [];
    parts.forEach((part, index) => {
      if (part) {
        result.push({ text: part, highlight: false });
      }
      if (matches[index]) {
        result.push({ text: matches[index], highlight: true });
      }
    });
    return result;
  },
  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  sortGroupFlowers(flowers, order) {
    if (order === 'name') {
      return [...flowers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }
    if (order === 'filled') {
      return [...flowers].sort((a, b) => {
        const aFilled = this.hasMeta(a);
        const bFilled = this.hasMeta(b);
        if (aFilled === bFilled) {
          return (a.name || '').localeCompare(b.name || '');
        }
        return aFilled ? -1 : 1;
      });
    }
    return flowers;
  },
  updateFilterSummary(keyword, order) {
    const parts = [];
    const groupValue = this.data.groupValues[this.data.groupIndex];
    const tierValue = this.data.tierValues[this.data.tierIndex];
    if (keyword) {
      parts.push(`关键词“${keyword}”`);
    }
    if (groupValue !== 'all') {
      parts.push(`第 ${groupValue} 组`);
    }
    if (tierValue !== 'all') {
      parts.push(tierValue);
    }
    if (this.data.onlyFilled) {
      parts.push('仅已补充');
    }
    if (this.data.aliasOnly) {
      parts.push('含别名');
    }
    if (this.data.meaningOnly) {
      parts.push('含花语');
    }
    if (this.data.seasonOnly) {
      parts.push('含季节');
    }
    if (this.data.seasonFilter !== 'all') {
      parts.push(`季节含“${this.data.seasonFilter}”`);
    }
    if (order === 'name') {
      parts.push('按花名排序');
    } else if (order === 'filled') {
      parts.push('已补充优先');
    }
    this.setData({
      metaSummaryText: parts.length ? `当前筛选：${parts.join('，')}` : '当前筛选：全部',
    });
  },
  onFlowerTap(event) {
    const name = event.currentTarget.dataset.name;
    if (!name) {
      return;
    }
    wx.navigateTo({
      url: `/pages/flower-detail/flower-detail?name=${encodeURIComponent(name)}`,
    });
  },
  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value });
    this.applyFilters();
  },
  onGroupChange(event) {
    this.setData({ groupIndex: Number(event.detail.value) });
    this.applyFilters();
  },
  onTierChange(event) {
    this.setData({ tierIndex: Number(event.detail.value) });
    this.applyFilters();
  },
  onSortChange(event) {
    this.setData({ sortIndex: Number(event.detail.value) });
    this.applyFilters();
  },
  onToggleFilled(event) {
    this.setData({ onlyFilled: event.detail.value });
    this.applyFilters();
  },
  onToggleAlias(event) {
    this.setData({ aliasOnly: event.detail.value });
    this.applyFilters();
  },
  onToggleMeaning(event) {
    this.setData({ meaningOnly: event.detail.value });
    this.applyFilters();
  },
  onToggleSeason(event) {
    this.setData({ seasonOnly: event.detail.value });
    this.applyFilters();
  },
  onQuickSeason(event) {
    const season = event.currentTarget.dataset.season;
    if (!season) {
      return;
    }
    const next = this.data.seasonFilter === season ? 'all' : season;
    this.setData({ seasonFilter: next });
    this.applyFilters();
  },
  onQuickToggle(event) {
    const key = event.currentTarget.dataset.toggle;
    const mapping = {
      filled: 'onlyFilled',
      meaning: 'meaningOnly',
      alias: 'aliasOnly',
      season: 'seasonOnly',
    };
    const stateKey = mapping[key];
    if (!stateKey) {
      return;
    }
    this.setData({ [stateKey]: !this.data[stateKey] });
    this.applyFilters();
  },
  onResetFilters() {
    this.setData({
      keyword: '',
      onlyFilled: false,
      aliasOnly: false,
      meaningOnly: false,
      seasonOnly: false,
      seasonFilter: 'all',
      groupIndex: 0,
      tierIndex: 0,
      sortIndex: 0,
    });
    this.applyFilters();
  },
  onClearSearch() {
    this.setData({ keyword: '' });
    this.applyFilters();
  },
  saveFilters() {
    const filters = {
      keyword: this.data.keyword,
      onlyFilled: this.data.onlyFilled,
      aliasOnly: this.data.aliasOnly,
      meaningOnly: this.data.meaningOnly,
      seasonOnly: this.data.seasonOnly,
      seasonFilter: this.data.seasonFilter,
      groupIndex: this.data.groupIndex,
      tierIndex: this.data.tierIndex,
      sortIndex: this.data.sortIndex,
    };
    wx.setStorageSync(STORAGE_KEY, filters);
  },
  applySavedFilters() {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (!stored) {
      return;
    }
    this.setData({
      keyword: stored.keyword || '',
      onlyFilled: Boolean(stored.onlyFilled),
      aliasOnly: Boolean(stored.aliasOnly),
      meaningOnly: Boolean(stored.meaningOnly),
      seasonOnly: Boolean(stored.seasonOnly),
      seasonFilter: stored.seasonFilter || 'all',
      groupIndex: stored.groupIndex || 0,
      tierIndex: stored.tierIndex || 0,
      sortIndex: stored.sortIndex || 0,
    });
  },
});
