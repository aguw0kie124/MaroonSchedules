"""Food Detector v3 — Two-stage precision-tuned free-food detection.

Stage A: Candidate generation (high recall)
    - Broad keyword matching with word boundaries
    - Tiered keyword scoring
    - Source/org prior boosts
    - Food-type inference

Stage B: Precision filtering (reduce false positives)
    - Require ≥2 independent cues for medium-confidence terms
    - Word-boundary safe matching (tea ≠ team/teaching/Texas)
    - Negative-context suppression
    - Virtual/online → automatic 0 (unless explicit food)
"""

from __future__ import annotations

import logging
import re
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("tamu_crawler.food_detector")

# ---------------------------------------------------------------------------
# Keyword tiers (ordered by confidence)
# ---------------------------------------------------------------------------

FOOD_KEYWORDS: Dict[str, List[str]] = {
    # Tier 0: Explicit food-provided phrases → 0.95
    "explicit": [
        "free food",
        "food provided",
        "food will be provided",
        "food and drinks",
        "food and drinks provided",
        "food and beverages",
        "refreshments provided",
        "refreshments will be served",
        "light refreshments",
        "heavy appetizers",
        "lunch provided",
        "lunch will be served",
        "lunch served",
        "dinner provided",
        "dinner will be served",
        "dinner served",
        "breakfast provided",
        "breakfast served",
        "food will be served",
        "snacks provided",
        "snacks and drinks",
        "meals provided",
        "meals available",
        "pizza & drinks",
        "pizza and drinks",
        "catered lunch",
        "catered dinner",
        "catered event",
        "complimentary lunch",
        "complimentary dinner",
        "complimentary breakfast",
        "free lunch",
        "free dinner",
        "free breakfast",
        "free pizza",
        "free tacos",
        "free ice cream",
        "free cookies",
        "free boba",
        "free drinks",
    ],
    # Tier 1: High-confidence food words → 0.9
    "high": [
        "pizza",
        "lunch",
        "dinner",
        "meal",
        "snacks",
        "catering",
        "catered",
        "breakfast",
        "bbq",
        "barbeque",
        "barbecue",
        "cookout",
        "cook-out",
        "potluck",
        "pot luck",
        "buffet",
        "tacos",
        "ice cream",
        "donuts",
        "doughnuts",
        "cookies",
        "cupcakes",
        "chick-fil-a",
        "chick fil a",
        "chickfila",
        "whataburger",
        "kolaches",
        "boba",
        "food truck",
        "food trucks",
        "crawfish",
        "crawfish boil",
        "pancakes",
        "waffles",
        "sandwich",
        "sandwiches",
        "subs",
        "wings",
        "chicken wings",
        "nachos",
        "burgers",
        "hot dogs",
        "hotdogs",
        "munchies",
        "appetizers",
        "refreshments",
    ],
    # Tier 2: Academic event patterns (almost always have food) → 0.80
    "academic": [
        "colloquium",
        "colloquia",
        "candidate talk",
        "job talk",
        "faculty candidate",
        "seminar series",
        "thesis defense",
        "dissertation defense",
        "distinguished lecture",
        "distinguished speaker",
        "invited speaker",
        "visiting scholar",
        "endowed lecture",
    ],
    # Tier 3: Medium-confidence context words → 0.55
    "medium": [
        "reception",
        "networking event",
        "info session",
        "information session",
        "speaker event",
        "general meeting",
        "body meeting",
        "interest meeting",
        "tabling",
        "open house",
        "study night",
        "game night",
        "movie night",
        "kickoff",
        "kick-off",
        "mixer",
        "social event",
        "social hour",
        "happy hour",
        "celebration",
        "banquet",
        "gala",
        "luncheon",
        "brunch",
        "coffee chat",
    ],
    # Tier 4: Low-confidence context words → 0.3 (need ≥2 cues)
    "low": [
        "social",
        "welcome",
        "welcome event",
        "welcome back",
        "pantry",
        "food pantry",
        "food drive",
        "tailgate",
        "watch party",
        "viewing party",
        "meet and greet",
        "meet & greet",
        "hangout",
        "hang out",
        "gathering",
        "fellowship",
        "community",
    ],
}

# Coffee/tea variants — scored ONLY with food context
COFFEE_TEA_KEYWORDS: List[str] = [
    "coffee",
    "espresso",
    "latte",
    "cappuccino",
    "chai",
]

# "tea" gets special handling to avoid matching "team", "teaching", "Texas"
TEA_KEYWORD = "tea"

# Context words that make coffee/tea count as food signal
COFFEE_TEA_CONTEXT: List[str] = [
    "provided",
    "served",
    "snacks",
    "food",
    "and tea",
    "and coffee",
    "coffee and",
    "tea and ",
    "cookies",
    "donuts",
    "pastries",
    "refreshments",
    "complimentary",
    "free",
    "grab",
    "light bites",
]

# Phrases that strongly suggest food (additive boost +0.15)
FOOD_PATTERNS: List[str] = [
    "while supplies last",
    "while supply lasts",
    "first come first serve",
    "first-come first-serve",
    "complimentary",
    "on us",
    "no cost",
    "we will provide",
    "we'll provide",
    "come grab",
    "come enjoy",
    "free for all",
    "grab a bite",
    "come eat",
    "provided",
    "served",
]

# Organisations known to frequently provide food
FOOD_ORGS: List[str] = [
    "msc",
    "memorial student center",
    "career center",
    "student activities",
    "student organizations",
    "engineering societies",
    "sec",
    "student engineers",
    "sga",
    "philsa",
    "tasa",
    "meloy",
    "mcferrin",
    "aggiesat",
    "aiche",
    "asme",
    "ieee",
    "shpe",
    "nsbe",
    "swe",
    "bap",
    "beta alpha psi",
    "alpfa",
    "fish camp",
    "big event",
    "rec sports",
    "student affairs",
    "residence life",
    "corps of cadets",
    "aggie traditions",
    "mays business",
    "honors",
    "camac",
]

# Source-level food priors (source_name → baseline boost)
SOURCE_FOOD_PRIORS: Dict[str, float] = {
    "mcferrin_events": 0.15,
    "mcferrin_programs": 0.10,
    "mays_undergrad_events": 0.10,
    "mays_career_center": 0.10,
    "career_center": 0.15,
    "career_center_events": 0.15,
    "career_fairs": 0.15,
    "msc": 0.10,
    "student_activities": 0.10,
    "student_interest": 0.10,
    "student_orgs": 0.10,
    "getinvolved_events": 0.08,
    "getinvolved_student_life": 0.08,
    "diversity": 0.08,
    "international": 0.08,
}

# Negative patterns (reduce false positives)
ANTI_FOOD_PATTERNS: List[str] = [
    "food science",
    "food engineering",
    "food safety",
    "food security",
    "food bank",
    "food systems",
    "food policy",
    "food industry",
    "food technology",
    "food processing",
    "food desert",
    "department of food",
    "food studies",
    "food court",
    "tea ceremony",
    "long island iced tea",
    "boston tea party",
]

# Virtual/online indicators (no food unless explicit)
VIRTUAL_PATTERNS: List[str] = ["virtual", "online", "webinar", "zoom", "remote", "microsoft teams"]

# Explicit food bypass for virtual check
EXPLICIT_FOOD_BYPASS: List[str] = [
    "pizza", "lunch", "dinner", "food", "breakfast",
    "snack", "refreshment", "catered", "bbq", "taco",
    "chick-fil-a", "cookie", "donut", "boba",
]

# Words that "tea" falsely matches inside
TEA_FALSE_POSITIVES: List[str] = [
    "team", "teams", "teaching", "teacher", "teachers",
    "texas", "teaming", "teamwork", "teammate", "teammates",
    "teal", "tear", "tears", "stealth", "steak", "steady",
    "instead", "theater", "theatre", "steam",
]

# ---------------------------------------------------------------------------
# Food-type classifier keywords
# ---------------------------------------------------------------------------

FOOD_TYPE_MAP: Dict[str, List[str]] = {
    "lunch": ["lunch", "luncheon", "noon meal", "midday"],
    "dinner": ["dinner", "supper", "evening meal", "banquet", "gala"],
    "breakfast": [
        "breakfast", "brunch", "morning", "kolaches", "pancakes",
        "waffles", "donuts", "doughnuts",
    ],
    "snacks": [
        "snacks", "pizza", "tacos", "nachos", "cookies", "cupcakes",
        "ice cream", "boba", "wings", "hot dogs", "hotdogs",
        "sandwiches", "burgers", "chick-fil-a", "whataburger",
        "crawfish", "appetizers", "munchies", "food truck",
        "refreshments", "light refreshments",
    ],
    "beverage": [
        "coffee", "tea", "drinks", "beverages", "boba",
        "latte", "espresso", "cappuccino", "chai",
    ],
    "reception": [
        "reception", "networking reception", "welcome reception",
    ],
}


def _word_match(keyword: str, text: str) -> bool:
    """Check if keyword appears as a whole word/phrase in text."""
    pattern = r"\b" + re.escape(keyword) + r"\b"
    return bool(re.search(pattern, text))


def _safe_tea_match(text: str) -> bool:
    """Check if 'tea' appears as a standalone word, not inside team/teaching/Texas/etc."""
    # Find all positions of 'tea' with word boundaries
    for m in re.finditer(r"\btea\b", text):
        start, end = m.start(), m.end()
        # Get surrounding context (10 chars each side)
        context = text[max(0, start - 10):min(len(text), end + 10)]
        # Check if any false positive word contains this 'tea'
        is_false = False
        for fp in TEA_FALSE_POSITIVES:
            if fp in context:
                is_false = True
                break
        if not is_false:
            return True
    return False


def _classify_food_type(text: str) -> str:
    """Determine the most specific food type from text."""
    text_lower = text.lower()
    # Check in priority order: specific meals > reception > snacks > beverage
    for food_type in ("lunch", "dinner", "breakfast", "reception", "snacks", "beverage"):
        for kw in FOOD_TYPE_MAP[food_type]:
            if _word_match(kw, text_lower):
                return food_type
    return "unknown"


def detect_food(
    title: str,
    description: str | None = None,
    host_name: str | None = None,
    tags: List[str] | None = None,
    host_type: str | None = None,
    duration_minutes: int | None = None,
    source_name: str | None = None,
) -> Tuple[bool, float, List[str], str]:
    """Detect if an event likely has free food — two-stage system.

    Stage A: Candidate generation (high recall, keyword matching)
    Stage B: Precision filtering (suppress false positives)

    Returns:
        (has_food, confidence, reasons, food_type)
    """
    text = f"{title} {description or ''} {' '.join(tags or [])}".lower()
    host_lower = (host_name or "").lower()
    title_lower = title.lower()
    source_lower = (source_name or "").lower()
    reasons: List[str] = []
    score = 0.0
    cue_count = 0  # Track independent cues for Stage B

    # ==================================================================
    # STAGE B PRE-CHECK: Virtual/online events → no food
    # ==================================================================
    is_virtual = any(vp in text for vp in VIRTUAL_PATTERNS)
    has_explicit_food = any(fp in text for fp in EXPLICIT_FOOD_BYPASS)
    if is_virtual and not has_explicit_food:
        return False, 0.0, [], "unknown"

    # ==================================================================
    # STAGE B PRE-CHECK: Strip anti-patterns
    # ==================================================================
    cleaned_text = text
    for anti in ANTI_FOOD_PATTERNS:
        if anti in cleaned_text:
            cleaned_text = cleaned_text.replace(anti, "")

    # ==================================================================
    # STAGE A: Candidate Generation
    # ==================================================================

    # --- Tier 0: Explicit food-provided phrases (0.95) ---
    for keyword in FOOD_KEYWORDS["explicit"]:
        if _word_match(keyword, cleaned_text):
            if 0.95 > score:
                score = 0.95
            cue_count += 1
            reasons.append(f"explicit:{keyword}")

    # --- Tier 1: High-confidence food keywords (0.9) ---
    for keyword in FOOD_KEYWORDS["high"]:
        if _word_match(keyword, cleaned_text):
            if 0.9 > score:
                score = 0.9
            cue_count += 1
            reasons.append(f"high_keyword:{keyword}")

    # --- Tier 2: Academic patterns (0.80) ---
    academic_match = False
    for keyword in FOOD_KEYWORDS["academic"]:
        if _word_match(keyword, cleaned_text):
            academic_match = True
            # Only boost to 0.80 base if no stronger signal
            base = 0.80
            # Extra boost if combined with food signal
            if any(_word_match(p, cleaned_text) for p in ["provided", "served", "refreshments"]):
                base = 0.92
                cue_count += 1
            if base > score:
                score = base
            cue_count += 1
            reasons.append(f"academic:{keyword}")

    # --- Tier 3: Medium-confidence keywords (0.55) ---
    medium_matches: List[str] = []
    for keyword in FOOD_KEYWORDS["medium"]:
        if _word_match(keyword, cleaned_text):
            medium_matches.append(keyword)
            cue_count += 1
            reasons.append(f"medium_keyword:{keyword}")

    # STAGE B: Medium keywords alone → only score if ≥2 independent cues
    if medium_matches and score < 0.55:
        has_food_pattern = any(p in cleaned_text for p in FOOD_PATTERNS)
        has_food_org = any(_word_match(org, host_lower) or _word_match(org, cleaned_text)
                          for org in FOOD_ORGS)
        if len(medium_matches) >= 2 or has_food_pattern or has_food_org:
            score = max(score, 0.60)
        else:
            # Single medium keyword alone → lower score
            score = max(score, 0.45)

    # --- Tier 4: Low-confidence keywords (0.3) ---
    low_matches: List[str] = []
    for keyword in FOOD_KEYWORDS["low"]:
        if _word_match(keyword, cleaned_text):
            low_matches.append(keyword)
            reasons.append(f"low_keyword:{keyword}")

    # STAGE B: Low keywords need ≥2 independent cues (including patterns/orgs)
    if low_matches and score < 0.3:
        has_food_pattern = any(p in cleaned_text for p in FOOD_PATTERNS)
        if has_food_pattern:
            score = max(score, 0.40)
            cue_count += 1
        elif cue_count >= 2:
            score = max(score, 0.35)
        # else: single low keyword → no score

    # --- Coffee/tea precision logic ---
    coffee_matched = False
    for kw in COFFEE_TEA_KEYWORDS:
        if _word_match(kw, cleaned_text):
            coffee_matched = True
            has_context = any(ctx in cleaned_text for ctx in COFFEE_TEA_CONTEXT)
            is_short = duration_minutes is not None and duration_minutes <= 90

            if has_context:
                boost = 0.65
                if boost > score:
                    score = boost
                cue_count += 1
                reasons.append(f"coffee_with_context:{kw}")
            elif is_short:
                boost = 0.45
                if boost > score:
                    score = boost
                reasons.append(f"coffee_short_event:{kw}")
            break

    # "tea" special handling — avoid team/teaching/Texas
    if not coffee_matched and _safe_tea_match(cleaned_text):
        has_context = any(ctx in cleaned_text for ctx in COFFEE_TEA_CONTEXT)
        if has_context:
            boost = 0.65
            if boost > score:
                score = boost
            cue_count += 1
            reasons.append("tea_with_context")

    # --- Student org meeting boost (+0.35) ---
    if host_type == "student_org":
        meeting_keywords = ["meeting", "social", "mixer", "gbm",
                            "general body", "interest meeting"]
        for mk in meeting_keywords:
            if _word_match(mk, cleaned_text):
                score = min(1.0, score + 0.35)
                cue_count += 1
                reasons.append(f"student_org_meeting:{mk}")
                break

    # --- Pattern matches (additive boost +0.12) ---
    pattern_count = 0
    for pattern in FOOD_PATTERNS:
        if pattern in cleaned_text:
            score = min(1.0, score + 0.12)
            pattern_count += 1
            cue_count += 1
            reasons.append(f"pattern:{pattern}")
            if pattern_count >= 3:
                break  # cap pattern boosts

    # --- Known food orgs (additive boost +0.10) ---
    for org in FOOD_ORGS:
        if _word_match(org, host_lower) or _word_match(org, cleaned_text):
            score = min(1.0, score + 0.10)
            cue_count += 1
            reasons.append(f"food_org:{org}")
            break

    # --- Source prior boost ---
    if source_lower in SOURCE_FOOD_PRIORS:
        prior = SOURCE_FOOD_PRIORS[source_lower]
        score = min(1.0, score + prior)
        reasons.append(f"source_prior:{source_lower}:{prior}")

    # --- Title-specific boost (+0.05) ---
    for keyword in FOOD_KEYWORDS["high"]:
        if _word_match(keyword, title_lower):
            score = min(1.0, score + 0.05)
            break
    for keyword in FOOD_KEYWORDS["explicit"]:
        if _word_match(keyword, title_lower):
            score = min(1.0, score + 0.05)
            break

    # ==================================================================
    # STAGE B: Final precision filtering
    # ==================================================================

    # Suppress "seminar" alone as food signal (unless another cue exists)
    if (score > 0 and score < 0.6
            and cue_count <= 1
            and any(r.startswith("academic:seminar") for r in reasons)):
        # Seminar alone without food cue → suppress
        if not any(r.startswith(("explicit:", "high_keyword:", "pattern:")) for r in reasons):
            score = 0.0
            reasons.append("suppressed:seminar_alone")

    # Suppress "social" alone (low keyword) without supporting context
    if (score > 0 and score <= 0.35
            and cue_count <= 1
            and any("low_keyword:social" in r for r in reasons)):
        if host_type != "student_org":
            score = 0.0
            reasons.append("suppressed:social_alone_no_org")

    # Clamp
    score = round(min(1.0, max(0.0, score)), 2)
    has_food = score >= 0.30

    # Deduplicate reasons
    reasons = list(dict.fromkeys(reasons))

    # Classify food type
    food_type = _classify_food_type(f"{title} {description or ''}") if has_food else "unknown"

    if has_food:
        logger.debug(
            "Food detected (%.2f, %s, %d cues): %s — %s",
            score,
            food_type,
            cue_count,
            title[:60],
            ", ".join(reasons[:5]),
        )

    return has_food, score, reasons, food_type
