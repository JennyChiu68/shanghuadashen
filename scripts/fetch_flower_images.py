#!/usr/bin/env python3
import argparse
import json
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

SOURCE_MD = "data/flowers.md"
OUTPUT_JSON = "data/flowers.json"
USER_AGENT = "FlowerImageFetcher/1.0 (+https://example.com)"
DEFAULT_TIMEOUT = 15

try:
    import certifi
except ImportError:  # pragma: no cover - optional dependency
    certifi = None


@dataclass
class FlowerRecord:
    name: str
    group: int
    tier: str
    image_url: str | None = None
    page_url: str | None = None
    source: str | None = None


def build_ssl_contexts() -> tuple[ssl.SSLContext, ssl.SSLContext]:
    if certifi:
        verified_context = ssl.create_default_context(cafile=certifi.where())
    else:
        verified_context = ssl.create_default_context()
    insecure_context = ssl._create_unverified_context()
    return verified_context, insecure_context


def is_cert_error(exc: BaseException) -> bool:
    if isinstance(exc, ssl.SSLError):
        return True
    return "CERTIFICATE_VERIFY_FAILED" in str(exc)


def build_openers(
    verified_context: ssl.SSLContext,
    insecure_context: ssl.SSLContext,
    use_proxy_env: bool,
    proxy_url: str | None,
) -> tuple[urllib.request.OpenerDirector, urllib.request.OpenerDirector]:
    if proxy_url:
        proxy_handler = urllib.request.ProxyHandler(
            {
                "http": proxy_url,
                "https": proxy_url,
            }
        )
    elif use_proxy_env:
        proxy_handler = urllib.request.ProxyHandler()
    else:
        proxy_handler = urllib.request.ProxyHandler({})
    verified_opener = urllib.request.build_opener(
        proxy_handler,
        urllib.request.HTTPSHandler(context=verified_context),
    )
    insecure_opener = urllib.request.build_opener(
        proxy_handler,
        urllib.request.HTTPSHandler(context=insecure_context),
    )
    return verified_opener, insecure_opener


def fetch_json(
    url: str,
    opener: urllib.request.OpenerDirector,
    fallback_opener: urllib.request.OpenerDirector,
    allow_insecure_fallback: bool,
) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with opener.open(request, timeout=DEFAULT_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ssl.SSLError) as exc:
        if allow_insecure_fallback and is_cert_error(exc):
            print(f"SSL verification failed for {url}, retrying without verification.")
            with fallback_opener.open(request, timeout=DEFAULT_TIMEOUT) as response:
                return json.loads(response.read().decode("utf-8"))
        print(f"Request failed for {url}: {exc}")
        raise


def build_page_url(page_base: str, site: str, title: str) -> str:
    encoded = urllib.parse.quote(title.replace(" ", "_"))
    base = page_base.format(site=site).rstrip("/")
    return f"{base}/{encoded}"


def query_page_image(
    site: str,
    title: str,
    api_base: str,
    page_base: str,
    opener: urllib.request.OpenerDirector,
    fallback_opener: urllib.request.OpenerDirector,
    allow_insecure_fallback: bool,
) -> tuple[str | None, str | None]:
    params = {
        "action": "query",
        "prop": "pageimages",
        "format": "json",
        "pithumbsize": "800",
        "titles": title,
    }
    api_base_url = api_base.format(site=site)
    url = f"{api_base_url}?{urllib.parse.urlencode(params)}"
    data = fetch_json(url, opener, fallback_opener, allow_insecure_fallback)
    pages = data.get("query", {}).get("pages", {})
    for page in pages.values():
        thumbnail = page.get("thumbnail", {}).get("source")
        if thumbnail:
            return thumbnail, build_page_url(page_base, site, page.get("title", title))
    return None, None


def search_title(
    site: str,
    query: str,
    api_base: str,
    opener: urllib.request.OpenerDirector,
    fallback_opener: urllib.request.OpenerDirector,
    allow_insecure_fallback: bool,
) -> str | None:
    params = {
        "action": "query",
        "list": "search",
        "format": "json",
        "srlimit": "1",
        "srsearch": query,
    }
    api_base_url = api_base.format(site=site)
    url = f"{api_base_url}?{urllib.parse.urlencode(params)}"
    data = fetch_json(url, opener, fallback_opener, allow_insecure_fallback)
    results = data.get("query", {}).get("search", [])
    if results:
        return results[0]["title"]
    return None


def query_openverse_image(
    query: str,
    api_base: str,
    opener: urllib.request.OpenerDirector,
    fallback_opener: urllib.request.OpenerDirector,
    allow_insecure_fallback: bool,
) -> tuple[str | None, str | None]:
    params = {
        "q": query,
        "page_size": "1",
    }
    base = api_base.rstrip("/")
    url = f"{base}?{urllib.parse.urlencode(params)}"
    data = fetch_json(url, opener, fallback_opener, allow_insecure_fallback)
    results = data.get("results", [])
    if results:
        result = results[0]
        image_url = result.get("url") or result.get("thumbnail")
        page_url = result.get("foreign_landing_url") or result.get("detail_url")
        return image_url, page_url
    return None, None


def resolve_image(
    name: str,
    source: str,
    openverse_base: str,
    wikipedia_api_base: str,
    wikipedia_page_base: str,
    opener: urllib.request.OpenerDirector,
    fallback_opener: urllib.request.OpenerDirector,
    allow_insecure_fallback: bool,
) -> tuple[str | None, str | None, str | None]:
    if source == "openverse":
        image_url, page_url = query_openverse_image(
            name,
            openverse_base,
            opener,
            fallback_opener,
            allow_insecure_fallback,
        )
        if not image_url:
            image_url, page_url = query_openverse_image(
                f"{name} flower",
                openverse_base,
                opener,
                fallback_opener,
                allow_insecure_fallback,
            )
        if image_url:
            return image_url, page_url, "openverse"
        return None, None, None

    image_url, page_url = query_page_image(
        "zh.wikipedia",
        name,
        wikipedia_api_base,
        wikipedia_page_base,
        opener,
        fallback_opener,
        allow_insecure_fallback,
    )
    if image_url:
        return image_url, page_url, "zh.wikipedia"

    search_query = f"{name} 花"
    title = search_title(
        "zh.wikipedia",
        search_query,
        wikipedia_api_base,
        opener,
        fallback_opener,
        allow_insecure_fallback,
    )
    if title:
        image_url, page_url = query_page_image(
            "zh.wikipedia",
            title,
            wikipedia_api_base,
            wikipedia_page_base,
            opener,
            fallback_opener,
            allow_insecure_fallback,
        )
        if image_url:
            return image_url, page_url, "zh.wikipedia"

    title = search_title(
        "en.wikipedia",
        name,
        wikipedia_api_base,
        opener,
        fallback_opener,
        allow_insecure_fallback,
    )
    if title:
        image_url, page_url = query_page_image(
            "en.wikipedia",
            title,
            wikipedia_api_base,
            wikipedia_page_base,
            opener,
            fallback_opener,
            allow_insecure_fallback,
        )
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
    parser = argparse.ArgumentParser(description="Fetch flower images from configured sources.")
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
    parser.add_argument(
        "--source",
        choices=["openverse", "wikipedia"],
        default="openverse",
        help="Image data source to use.",
    )
    parser.add_argument(
        "--openverse-base",
        default="https://api.openverse.engineering/v1/images",
        help="Override the Openverse API base URL.",
    )
    parser.add_argument(
        "--wikipedia-api-base",
        default="https://{site}.org/w/api.php",
        help="Override the Wikipedia API base URL (use {site} placeholder).",
    )
    parser.add_argument(
        "--wikipedia-page-base",
        default="https://{site}.org/wiki",
        help="Override the Wikipedia page base URL (use {site} placeholder).",
    )
    parser.add_argument(
        "--insecure",
        action="store_true",
        help="Disable SSL certificate verification for all requests (not recommended).",
    )
    parser.add_argument(
        "--no-proxy",
        action="store_true",
        help="Bypass proxy settings when making requests.",
    )
    parser.add_argument(
        "--proxy-url",
        help="Explicit proxy URL to use for requests (overrides environment).",
    )
    parser.add_argument(
        "--no-insecure-fallback",
        action="store_true",
        help="Disable automatic SSL verification fallback.",
    )
    args = parser.parse_args()

    verified_context, insecure_context = build_ssl_contexts()
    allow_insecure_fallback = not args.no_insecure_fallback
    verified_opener, insecure_opener = build_openers(
        verified_context,
        insecure_context,
        use_proxy_env=not args.no_proxy,
        proxy_url=args.proxy_url,
    )
    if args.insecure:
        opener = insecure_opener
        allow_insecure_fallback = False
    else:
        opener = verified_opener

    flowers = parse_flower_md(SOURCE_MD)
    for record in flowers:
        if args.offline:
            continue
        try:
            image_url, page_url, source = resolve_image(
                record.name,
                args.source,
                args.openverse_base,
                args.wikipedia_api_base,
                args.wikipedia_page_base,
                opener,
                insecure_opener,
                allow_insecure_fallback,
            )
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
