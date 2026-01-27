const statusEl = document.getElementById('status');
const groupsEl = document.getElementById('groups');

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

  flowers.forEach((flower) => {
    const card = document.createElement('div');
    card.className = 'flower-card';

    const name = document.createElement('div');
    name.className = 'flower-card__name';
    name.textContent = flower.name ?? '未命名';

    const note = document.createElement('div');
    note.className = 'flower-card__note';
    note.textContent = flower.image_url ? '图片已准备' : '图片待补充';

    card.appendChild(name);
    card.appendChild(note);
    list.appendChild(card);
  });

  group.appendChild(list);
  return group;
}

async function loadFlowers() {
  try {
    const response = await fetch('../data/flowers.json');
    if (!response.ok) {
      throw new Error(`数据请求失败 (${response.status})`);
    }
    const flowers = await response.json();
    const grouped = groupByGroup(flowers);

    statusEl.textContent = `已加载 ${flowers.length} 个花名。`;
    groupsEl.innerHTML = '';
    grouped.forEach((items, groupId) => {
      groupsEl.appendChild(renderGroup(groupId, items));
    });

    groupsEl.hidden = false;
  } catch (error) {
    statusEl.textContent = `加载失败：${error.message}`;
  }
}

loadFlowers();
