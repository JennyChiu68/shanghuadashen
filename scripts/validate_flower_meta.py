import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    root = Path(__file__).resolve().parents[1]
    flowers_path = root / "data" / "flowers.json"
    meta_path = root / "data" / "flower_meta.json"

    flowers = load_json(flowers_path)
    meta = load_json(meta_path)

    flower_names = [item["name"] for item in flowers]
    meta_names = [item["name"] for item in meta]

    errors = []

    if len(flowers) != len(meta):
        errors.append(f"数量不一致：flowers={len(flowers)} meta={len(meta)}")

    duplicates = {name for name in meta_names if meta_names.count(name) > 1}
    if duplicates:
        errors.append(f"元信息存在重复花名：{', '.join(sorted(duplicates))}")

    missing_meta = [name for name in flower_names if name not in meta_names]
    if missing_meta:
        errors.append(f"缺少元信息条目：{', '.join(missing_meta)}")

    extra_meta = [name for name in meta_names if name not in flower_names]
    if extra_meta:
        errors.append(f"存在多余元信息条目：{', '.join(extra_meta)}")

    allowed_season_chars = set("春夏秋冬")
    for item in meta:
        name = item["name"]
        if not item.get("alias"):
            errors.append(f"{name} 缺少别名 alias")
        if not item.get("meaning"):
            errors.append(f"{name} 缺少花语 meaning")
        if not item.get("season"):
            errors.append(f"{name} 缺少季节 season")
        if not item.get("pinyin"):
            errors.append(f"{name} 缺少拼音 pinyin")
        if not item.get("pinyinInitials"):
            errors.append(f"{name} 缺少拼音首字母 pinyinInitials")
        season_text = str(item.get("season", ""))
        if season_text and not set(season_text) <= allowed_season_chars:
            errors.append(f"{name} season 格式不符合：{season_text}")

    if errors:
        print("校验失败：")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("花名元信息校验通过。")


if __name__ == "__main__":
    main()
