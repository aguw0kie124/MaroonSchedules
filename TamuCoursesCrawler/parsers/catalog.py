from __future__ import annotations

import hashlib
import json
import re
from typing import Dict, Iterable, List, Optional
from urllib.parse import urljoin, quote_plus

from bs4 import BeautifulSoup

from http_client import CrawlerHttpClient
from models import Course, DegreePlan, PrereqGroup, SemesterSlot, SourceConfig, utc_now_iso

COURSE_CODE_RE = re.compile(r"\b([A-Z]{2,5})\s+(\d{3})\b")
CATALOG_YEAR_RE = re.compile(r"(20\d{2}\s*-\s*20\d{2})")


def _slugify(value: str) -> str:
    text = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return text or "plan"


def _normalize_course_code(value: str) -> Optional[str]:
    match = COURSE_CODE_RE.search(value.upper())
    if not match:
        return None
    return f"{match.group(1)} {match.group(2)}"


def _parse_credit_hours(value: str) -> int:
    match = re.search(r"(\d+)", value or "")
    return int(match.group(1)) if match else 0


def _parse_prerequisite_groups(text: str) -> tuple[List[PrereqGroup], List[str]]:
    raw = (text or "").strip()
    if not raw:
        return [], []

    normalized = re.sub(r"\s+", " ", raw)
    corequisites = sorted({
        f"{match.group(1)} {match.group(2)}"
        for match in COURSE_CODE_RE.finditer(normalized)
        if "concurrent" in normalized.lower()
    })

    groups: List[PrereqGroup] = []
    and_chunks = re.split(r"\band\b", normalized, flags=re.IGNORECASE)
    for and_chunk in and_chunks:
        courses = [
            f"{match.group(1)} {match.group(2)}"
            for match in COURSE_CODE_RE.finditer(and_chunk.upper())
        ]
        if not courses:
            continue
        operator = "OR" if re.search(r"\bor\b", and_chunk, flags=re.IGNORECASE) else "AND"
        deduped = list(dict.fromkeys(courses))
        groups.append(PrereqGroup(operator=operator, courses=deduped))
    return groups, corequisites


def _extract_catalog_year(soup: BeautifulSoup) -> str:
    text = soup.get_text(" ", strip=True)
    match = CATALOG_YEAR_RE.search(text)
    return match.group(1).replace(" ", "") if match else "unknown"


def _extract_major_links(index_html: str, base_url: str) -> List[str]:
    soup = BeautifulSoup(index_html, "lxml")
    links: List[str] = []
    for anchor in soup.select("a[href]"):
        href = anchor.get("href", "").strip()
        if not href:
            continue
        absolute = urljoin(base_url, href)
        if "/undergraduate/" not in absolute:
            continue
        if absolute.rstrip("/") == base_url.rstrip("/"):
            continue
        if absolute not in links:
            links.append(absolute)
    return links


def _find_plan_table(soup: BeautifulSoup):
    selectors = [
        ".planofstudy table",
        ".plan-of-study table",
        "table.sc_courselist",
        "table",
    ]
    for selector in selectors:
        table = soup.select_one(selector)
        if table is not None:
            return table
    return None


def _parse_degree_page(
    html: str,
    url: str,
    college: str,
    course_lookup: Dict[str, Course],
) -> Optional[DegreePlan]:
    soup = BeautifulSoup(html, "lxml")
    title_el = soup.select_one("h1")
    degree = title_el.get_text(" ", strip=True) if title_el else "Unknown Degree"
    major = degree.replace("Bachelor of Science in", "").replace("Bachelor of Arts in", "").strip() or degree
    catalog_year = _extract_catalog_year(soup)
    table = _find_plan_table(soup)
    if table is None:
        return None

    semester_headers: List[tuple[str, str]] = []
    header_cells = table.select("tr th")
    for cell in header_cells:
        text = cell.get_text(" ", strip=True)
        if not text:
            continue
        if any(token in text.lower() for token in ["fall", "spring", "summer"]):
            year_label = "Freshman"
            lowered = text.lower()
            if "sophomore" in lowered:
                year_label = "Sophomore"
            elif "junior" in lowered:
                year_label = "Junior"
            elif "senior" in lowered:
                year_label = "Senior"
            season = "Fall" if "fall" in lowered else "Spring" if "spring" in lowered else "Summer"
            semester_headers.append((year_label, season))

    semester_buckets: List[SemesterSlot] = [
        SemesterSlot(semester=index + 1, year_label=year_label, season=season, courses=[])
        for index, (year_label, season) in enumerate(semester_headers)
    ]

    total_hours = 0
    for row in table.select("tr"):
        cells = row.find_all(["td", "th"])
        if len(cells) < 2:
            continue
        first_text = cells[0].get_text(" ", strip=True)
        course_code = _normalize_course_code(first_text)
        if not course_code:
            continue
        for idx, slot in enumerate(semester_buckets):
            target_idx = idx + 1
            if target_idx >= len(cells):
                continue
            slot_text = cells[target_idx].get_text(" ", strip=True)
            if not slot_text:
                continue
            if course_code not in slot.courses:
                slot.courses.append(course_code)
        detail = course_lookup.get(course_code)
        if detail:
            total_hours += detail.credit_hours

    department = semester_buckets[0].courses[0].split()[0] if semester_buckets and semester_buckets[0].courses else _slugify(major).split("-")[0].upper()
    plan_id = f"tamu:plan:{_slugify(major)}-{catalog_year.lower()}"
    return DegreePlan(
        id=plan_id,
        college=college,
        department=department,
        degree=degree,
        major=major,
        catalog_year=catalog_year,
        total_hours=total_hours,
        semesters=semester_buckets,
        source_url=url,
        scraped_at=utc_now_iso(),
    )


def _parse_course_search_result(html: str, source_url: str, course_code: str) -> Optional[Course]:
    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text("\n", strip=True)
    code = _normalize_course_code(course_code)
    if not code:
        return None
    department, number = code.split()

    title = code
    description = None
    raw_prereq_text = None
    credit_hours = 0

    for heading in soup.select("h1, h2, h3, p"):
        heading_text = heading.get_text(" ", strip=True)
        if code in heading_text.upper():
            title = re.sub(r"\s+", " ", heading_text)
            break

    credit_match = re.search(r"credit\s*hours?.{0,10}(\d+)|(\d+)\s+credit\s+hours?", text, flags=re.IGNORECASE)
    if credit_match:
        credit_hours = int(next(group for group in credit_match.groups() if group))

    desc_candidates = soup.select("p")
    for paragraph in desc_candidates:
        paragraph_text = paragraph.get_text(" ", strip=True)
        if len(paragraph_text) > 40 and code not in paragraph_text.upper():
            description = paragraph_text
            break

    prereq_match = re.search(r"Prerequisite[s]?:\s*(.+?)(?:Corequisite|$)", text, flags=re.IGNORECASE | re.DOTALL)
    if prereq_match:
        raw_prereq_text = re.sub(r"\s+", " ", prereq_match.group(1)).strip(" .;")

    coreq_match = re.search(r"Corequisite[s]?:\s*(.+?)(?:$)", text, flags=re.IGNORECASE | re.DOTALL)
    coreq_text = re.sub(r"\s+", " ", coreq_match.group(1)).strip(" .;") if coreq_match else ""

    prerequisites, parsed_coreqs = _parse_prerequisite_groups(raw_prereq_text or "")
    extra_coreqs = []
    for match in COURSE_CODE_RE.finditer(coreq_text.upper()):
        extra_coreqs.append(f"{match.group(1)} {match.group(2)}")
    coreqs = list(dict.fromkeys(parsed_coreqs + extra_coreqs))

    return Course(
        id=f"tamu:course:{department}{number}",
        department=department,
        number=number,
        title=title,
        credit_hours=credit_hours,
        description=description,
        prerequisites=prerequisites,
        corequisites=coreqs,
        raw_prereq_text=raw_prereq_text,
        source_url=source_url,
        scraped_at=utc_now_iso(),
    )


async def crawl_catalog_source(
    source: SourceConfig,
    http_client: CrawlerHttpClient,
    *,
    dry_run: bool = False,
) -> tuple[List[Course], List[DegreePlan]]:
    if dry_run:
        return [], []

    index_html, status, _ = await http_client.fetch(source.url)
    if not index_html or status == 304:
        return [], []

    major_links = _extract_major_links(index_html, source.url)
    course_lookup: Dict[str, Course] = {}
    degree_plans: List[DegreePlan] = []

    for major_link in major_links:
        detail_html, detail_status, _ = await http_client.fetch(major_link)
        if not detail_html or detail_status == 304:
            continue

        soup = BeautifulSoup(detail_html, "lxml")
        discovered_codes = list({
            f"{match.group(1)} {match.group(2)}"
            for match in COURSE_CODE_RE.finditer(soup.get_text(" ", strip=True).upper())
        })

        for code in discovered_codes:
            if code in course_lookup:
                continue
            search_url = f"https://catalog.tamu.edu/search/?search={quote_plus(code)}"
            course_html, course_status, _ = await http_client.fetch(search_url, use_conditional=False)
            if not course_html or course_status == 304:
                continue
            parsed_course = _parse_course_search_result(course_html, search_url, code)
            if parsed_course:
                course_lookup[code] = parsed_course

        plan = _parse_degree_page(detail_html, major_link, source.college or "Unknown", course_lookup)
        if plan:
            degree_plans.append(plan)

    courses = sorted(course_lookup.values(), key=lambda item: (item.department, item.number, item.scraped_at))
    return courses, degree_plans
