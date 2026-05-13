from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from http_client import CrawlerHttpClient
from models import GradeDistribution, SourceConfig, utc_now_iso


def _normalize_term(term: str) -> str:
    value = (term or "").strip().upper()
    if re.fullmatch(r"\d{4}[FSU]", value):
        return value
    match = re.search(r"(20\d{2}).*(SPRING|SUMMER|FALL)", value)
    if not match:
        return value or "UNKNOWN"
    suffix = {"SPRING": "S", "SUMMER": "U", "FALL": "F"}[match.group(2)]
    return f"{match.group(1)}{suffix}"


def _coerce_int(value: Any) -> int:
    try:
        return int(float(str(value).strip()))
    except Exception:
        return 0


def _coerce_float(value: Any) -> float | None:
    try:
        return float(str(value).strip())
    except Exception:
        return None


def _extract_json_records(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    records: List[Dict[str, Any]] = []
    for script in soup.select("script"):
        script_text = script.string or script.get_text()
        if not script_text:
            continue
        for match in re.finditer(r"(\[\s*\{.*?\}\s*\])", script_text, flags=re.DOTALL):
            candidate = match.group(1)
            try:
                parsed = json.loads(candidate)
            except Exception:
                continue
            if isinstance(parsed, list) and parsed and isinstance(parsed[0], dict):
                records.extend(parsed)
    return records


def _extract_table_records(html: str) -> List[Dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    records: List[Dict[str, Any]] = []
    for table in soup.select("table"):
        headers = [cell.get_text(" ", strip=True).lower() for cell in table.select("tr th")]
        if not headers:
            continue
        for row in table.select("tr")[1:]:
            cells = [cell.get_text(" ", strip=True) for cell in row.find_all("td")]
            if len(cells) != len(headers):
                continue
            record = dict(zip(headers, cells))
            records.append(record)
        if records:
            break
    return records


def _record_to_grade_distribution(record: Dict[str, Any], source_url: str) -> GradeDistribution | None:
    department = (
        record.get("department")
        or record.get("subject")
        or record.get("dept")
        or ""
    ).strip().upper()
    course_number = str(
        record.get("course_number")
        or record.get("course")
        or record.get("number")
        or ""
    ).strip()
    instructor = str(record.get("instructor") or record.get("professor") or "STAFF").strip()
    if not department or not course_number:
        combined = str(record.get("course") or record.get("course_code") or "")
        match = re.search(r"([A-Z]{2,5})\s*(\d{3})", combined.upper())
        if match:
            department = department or match.group(1)
            course_number = course_number or match.group(2)
    if not department or not course_number:
        return None

    term = _normalize_term(str(record.get("term") or record.get("semester") or record.get("term_code") or ""))
    section = str(record.get("section") or record.get("sec") or "").strip() or None
    grades = {
        "A": _coerce_int(record.get("A") or record.get("a_count")),
        "B": _coerce_int(record.get("B") or record.get("b_count")),
        "C": _coerce_int(record.get("C") or record.get("c_count")),
        "D": _coerce_int(record.get("D") or record.get("d_count")),
        "F": _coerce_int(record.get("F") or record.get("f_count")),
        "Q": _coerce_int(record.get("Q") or record.get("q_count")),
        "other": _coerce_int(record.get("other") or record.get("i_count") or 0),
    }
    total = sum(grades.values())
    row_id = f"tamu:grades:{department}{course_number}:{term}:{instructor}:{section or 'all'}"
    return GradeDistribution(
        id=row_id,
        department=department,
        course_number=course_number,
        course_title=(record.get("course_title") or record.get("title") or None),
        instructor=instructor,
        term=term,
        section=section,
        gpa=_coerce_float(record.get("gpa") or record.get("avg_gpa")),
        grades=grades,
        total_enrolled=total,
        source_url=source_url,
        scraped_at=utc_now_iso(),
    )


async def crawl_annex_source(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
    *,
    dry_run: bool = False,
) -> List[GradeDistribution]:
    if dry_run:
        return []

    html, status, _ = await http_client.fetch(source.url)
    if not html or status == 304:
        return []

    json_records = _extract_json_records(html)
    table_records = _extract_table_records(html) if not json_records else []
    raw_records = json_records or table_records

    if not raw_records:
        soup = BeautifulSoup(html, "lxml")
        candidates = []
        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "")
            if "grade" in href.lower() or "distribution" in href.lower() or "api" in href.lower():
                candidates.append(urljoin(source.url, href))
        for candidate in candidates[:5]:
            candidate_html, _, _ = await http_client.fetch(candidate, use_conditional=False)
            if not candidate_html:
                continue
            raw_records = _extract_json_records(candidate_html) or _extract_table_records(candidate_html)
            if raw_records:
                source_url = candidate
                break
        else:
            source_url = source.url
    else:
        source_url = source.url

    rows: List[GradeDistribution] = []
    for record in raw_records:
        parsed = _record_to_grade_distribution(record, source_url)
        if parsed:
            rows.append(parsed)
    return rows
