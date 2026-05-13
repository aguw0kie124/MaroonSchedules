from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    text = re.sub(r"<[^>]+>", " ", value)
    text = (
        text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", '"')
        .replace("&#39;", "'")
    )
    return re.sub(r"\s+", " ", text).strip()


def normalize_key(value: str | None) -> str:
    text = clean_text(value).lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def slugify(value: str | None) -> str:
    return normalize_key(value).replace(" ", "-")


def unique_strings(values: Iterable[str | None]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = clean_text(value)
        key = normalize_key(cleaned)
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(cleaned)
    return result


def canonicalize_url(url: str | None) -> str:
    if not url:
        return ""
    raw = url.strip()
    if "://" not in raw and not raw.startswith("//"):
        raw = f"https://{raw}"
    elif raw.startswith("//"):
        raw = f"https:{raw}"
    parsed = urlparse(raw)
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/" and path.endswith("/"):
        path = path[:-1]

    query_items = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if not key.lower().startswith("utm_")
        and key.lower() not in {"fbclid", "gclid", "gad_source", "gbraid", "wbraid"}
    ]
    query = urlencode(sorted(query_items))
    return urlunparse((scheme, netloc, path, "", query, ""))
