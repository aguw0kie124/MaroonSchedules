from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SitemapSource:
    name: str
    sitemap_url: str
    city: str
    area_label: str | None = None
    kind: str = "event"


@dataclass(frozen=True)
class CuratedPageSource:
    name: str
    url: str
    business_name: str
    city: str
    area_label: str
    parser: str


VISIT_CSTX_EVENTS = SitemapSource(
    name="visit_cstx_events",
    sitemap_url="https://visit.cstx.gov/sitemaps-1-event-default-1-sitemap.xml",
    city="College Station",
)

DESTINATION_BRYAN_EVENTS = SitemapSource(
    name="destination_bryan_events",
    sitemap_url="https://www.destinationbryan.com/sitemaps-1-event-default-1-sitemap.xml",
    city="Bryan",
)

CURATED_PROMOTION_PAGES = [
    CuratedPageSource(
        name="fridas_specials",
        url="https://www.fridaskitchenbcs.com/specials",
        business_name="Frida's Kitchen + Bar",
        city="Bryan",
        area_label="Downtown Bryan",
        parser="fridas",
    ),
    CuratedPageSource(
        name="the_owl_promotions",
        url="https://www.theowlbcs.com/",
        business_name="The Owl Pub and Grill",
        city="Bryan",
        area_label="Downtown Bryan",
        parser="owl",
    ),
    CuratedPageSource(
        name="messina_hof_bryan",
        url="https://messinahof.com/bryan/",
        business_name="Messina Hof Winery",
        city="Bryan",
        area_label="Bryan",
        parser="messina_hof",
    ),
    CuratedPageSource(
        name="spot_on_northgate",
        url="https://visit.cstx.gov/directory/the-spot-on-northgate/",
        business_name="The Spot on Northgate",
        city="College Station",
        area_label="Northgate",
        parser="spot_directory",
    ),
]

NEXT_SOURCE_CANDIDATES = [
    ("Northgate music venues", "Rough Draught, O'Bannon's, The Corner, and 12 Rooftop Bar event pages"),
    ("Century Square dine pages", "Retailer and restaurant pages under Century Square directory for rotating specials"),
    ("Visit CSTX partner directory", "Northgate and live-music partner pages with happy-hour or recurring-night descriptions"),
    ("Destination Bryan partner pages", "Historic Downtown Bryan venue pages with specials and event calendars"),
    ("Lake Walk / Midtown venues", "Recurring live music and pop-up markets around Lake Walk"),
    ("Hotel + restaurant collabs", "Student-friendly prix-fixe, brunch, and rooftop specials worth surfacing as promotions"),
]
