# shanghuadashen

## 花名列表页（不含图片）

当前先绕过图片，先展示花名、分组与基础元信息（别名、花语、季节）。元信息放在 `data/flower_meta.json`，未填写会显示“待补充”，页面上会显示元信息完成度与统计，并提供搜索（花名/别名/花语/季节/常见度/组别）、分组与常见度筛选、别名/花语/季节筛选、排序与一键清除条件，搜索关键词会在卡片中高亮（不区分大小写），筛选为空时会提示无匹配结果，筛选条件会自动记住，并支持单独清除搜索词。你可以用下面的命令在本地打开页面。

### 元信息填写规范（`data/flower_meta.json`）
- `name`：必须与 `data/flowers.json` 中的花名一致。
- `alias`：数组，写常见别名，没有就留空数组 `[]`。
- `meaning`：一句话花语，没有就留空字符串 `""`。
- `season`：开花季节，建议用“春/夏/秋/冬”或“春夏/夏秋”等组合。

```bash
python3 -m http.server 8000
```

然后打开：

```
http://localhost:8000/web/flower-list.html
```

## 微信小程序版本

已新增微信小程序的基础结构，页面入口为 `pages/flower-list/flower-list`，读取同一份 `data/flowers.json` 与 `data/flower_meta.json` 数据进行展示与筛选，并支持点击卡片进入详情页（`pages/flower-detail/flower-detail`）。可以直接在微信开发者工具中打开本仓库进行预览。
