Page({
  data: {
    flower: null,
    aliasText: '待补充',
    meaningText: '待补充',
    seasonText: '待补充',
    pinyinText: '—',
    initialsText: '—',
    seasonHint: '待补充',
    statusText: '加载中…',
  },
  onLoad(options) {
    const name = options.name ? decodeURIComponent(options.name) : '';
    if (!name) {
      this.setData({ statusText: '未找到花名信息。' });
      return;
    }
    const flowers = require('../../data/flowers.json');
    const metas = require('../../data/flower_meta.json');
    const metaMap = new Map();
    metas.forEach((meta) => {
      if (meta && meta.name) {
        metaMap.set(meta.name, meta);
      }
    });
    const base = flowers.find((flower) => flower.name === name);
    if (!base) {
      this.setData({ statusText: '未找到花名信息。' });
      return;
    }
    const meta = metaMap.get(name) || {};
    const aliasText = Array.isArray(meta.alias) && meta.alias.length
      ? meta.alias.join(' / ')
      : '待补充';
    const meaningText = meta.meaning && meta.meaning.trim() ? meta.meaning : '待补充';
    const seasonText = meta.season && meta.season.trim() ? meta.season : '待补充';
    const pinyinText = meta.pinyin && meta.pinyin.trim() ? meta.pinyin : '—';
    const initialsText = meta.pinyinInitials && meta.pinyinInitials.trim()
      ? meta.pinyinInitials
      : '—';
    const seasonHint = seasonText !== '待补充' ? `推荐在${seasonText}观赏` : '待补充';
    this.setData({
      flower: {
        ...base,
        alias: meta.alias || [],
        meaning: meta.meaning || '',
        season: meta.season || '',
      },
      aliasText,
      meaningText,
      seasonText,
      pinyinText,
      initialsText,
      seasonHint,
      statusText: '',
    });
    wx.setNavigationBarTitle({ title: name });
  },
});
