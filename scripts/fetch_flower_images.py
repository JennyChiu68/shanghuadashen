#!/usr/bin/env python3
import argparse
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

SOURCE_MD = "data/flowers.md"
OUTPUT_JSON = "data/flowers.json"
USER_AGENT = "FlowerImageFetcher/1.0 (+https://example.com)"


@dataclass
class FlowerRecord:
    name: str
    group: int
    tier: str
    image_url: str | None = None
    page_url: str | None = None
    source: str | None = None


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"Request failed for {url}: {exc}")
        raise


def build_page_url(site: str, title: str) -> str:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    return f"https://{site}.org/wiki/{encoded}"


def query_page_image(site: str, title: str) -> tuple[str | None, str | None]:
    params = {
        "action": "query",
        "prop": "pageimages",
        "format": "json",
        "pithumbsize": "800",
        "titles": title,
    }
    url = f"https://{site}.org/w/api.php?{urllib.parse.urlencode(params)}"
    data = fetch_json(url)
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        thumbnail = page.get("thumbnail", {}).get("source")
        if thumbnail:
            return thumbnail, build_page_url(site, page.get("title", title))
    return None, None


def search_title(site: str, query: str) -> str | None:
    params = {
        "action": "query",
        "list": "search",
        "format": "json",
        "srlimit": "1",
        "srsearch": query,
    }
    url = f"https://{site}.org/w/api.php?{urllib.parse.urlencode(params)}"
    data = fetch_json(url)
    results = data.get("query", {}).get("search", [])
    if results:
        return results[0]["title"]
    return None


def resolve_image(name: str) -> tuple[str | None, str | None, str | None]:
    image_url, page_url = query_page_image("zh.wikipedia", name)
    if image_url:
        return image_url, page_url, "zh.wikipedia"

    search_query = f"{name} 花"
    title = search_title("zh.wikipedia", search_query)
    if title:
        image_url, page_url = query_page_image("zh.wikipedia", title)
        if image_url:
            return image_url, page_url, "zh.wikipedia"

    title = search_title("en.wikipedia", name)
    if title:
        image_url, page_url = query_page_image("en.wikipedia", title)
        if image_url:
            return image_url, page_url, "en.wikipedia"

    return None, None, None


def parse_flower_md(path: str) -> list[FlowerRecord]:
    records: list[FlowerRecord] = []
    group = 0
    tier = ""
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line.startswith("## 第 "):
                match = re.match(r"## 第\s+(\d+)\s+组：(.+?)（\d+）", line)
                if match:
                    group = int(match.group(1))
                    tier = match.group(2)
                continue
            match = re.match(r"\d+\.\s+(.*)", line)
            if match:
                name = match.group(1).strip()
                records.append(FlowerRecord(name=name, group=group, tier=tier))
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch flower images from Wikipedia.")
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Skip network calls and emit a template JSON with empty image URLs.",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.2,
        help="Delay (seconds) between API requests.",
    )
    args = parser.parse_args()

    flowers = parse_flower_md(SOURCE_MD)
    for record in flowers:
        if args.offline:
            continue
        try:
            image_url, page_url, source = resolve_image(record.name)
            record.image_url = image_url
            record.page_url = page_url
            record.source = source
            time.sleep(args.delay)
        except (urllib.error.URLError, TimeoutError) as exc:
            record.image_url = None
            record.page_url = None
            record.source = None
            print(f"Network error while fetching {record.name}: {exc}")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as handle:
        json.dump(
            [record.__dict__ for record in flowers],
            handle,
            ensure_ascii=False,
            indent=2,
        )

    missing = [record.name for record in flowers if not record.image_url]
    if missing:
        print("Missing images:")
        for name in missing:
            print(f"- {name}")


if __name__ == "__main__":
    main()
