# 花朵图片获取说明

当前仓库提供了 100 种花的分组清单与对应的数据模板（`data/flowers.json`），用于存放每个花朵的真实图片链接与来源页面。

## 自动抓取方法（推荐）

脚本：`scripts/fetch_flower_images.py`

此脚本会从 Openverse 获取每个花朵的首图与页面链接，并写入 `data/flowers.json`（可用 `--source wikipedia` 切换回维基百科）。

```bash
python3 scripts/fetch_flower_images.py
```

输出字段说明（`data/flowers.json`）：
- `name`：花名
- `group`：分组编号（1-5）
- `tier`：分组描述（如“最常见”）
- `image_url`：图片链接
- `page_url`：来源页面
- `source`：来源站点（如 `openverse`、`zh.wikipedia`）

脚本会为每次请求统一添加 `User-Agent` 请求头，若请求失败会输出失败的 URL，便于定位被拦截或不可达的链接。
如果遇到 SSL 证书验证失败，脚本会自动降级为不校验证书的请求并继续抓取；如需禁用该降级，可使用 `--no-insecure-fallback`。
如果需要绕过代理设置，可使用 `--no-proxy`。
如果环境的代理对外部 API 有限制，可通过 `--proxy-url` 指定可用的代理，或使用 `--openverse-base`/`--wikipedia-api-base`/`--wikipedia-page-base` 指向可访问的镜像服务。

## 无网络或被限制环境（生成模板）

若当前环境无法访问外网，可先生成空模板，然后在可访问外网的环境中重新执行抓取脚本覆盖。

```bash
python3 scripts/fetch_flower_images.py --offline
```

这会生成 `image_url` 为空的模板，便于后续手动或自动补全。
