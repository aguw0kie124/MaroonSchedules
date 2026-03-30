"""Parser registry — maps source types to parser callables."""

from __future__ import annotations

from typing import Callable, Dict

# Lazy imports to avoid circular dependencies
_REGISTRY: Dict[str, str] = {
    "livewhale_json": "parsers.livewhale:parse_livewhale",
    "rss_directory": "parsers.rss:parse_rss_directory",
    "html": "parsers.getinvolved:parse_getinvolved_events",
    "html_pagination": "parsers.getinvolved:parse_getinvolved_orgs",
    "html_search": "parsers.getinvolved:parse_getinvolved_search",
    "html_events": "parsers.html_generic:parse_html_events",
    "html_multi_url": "parsers.html_generic:parse_multi_url_events",
}


def get_parser(source_type: str, parser_name: str | None = None) -> Callable:
    """Return the parser callable for a given source type.

    If parser_name is provided and matches a known key (e.g. 'getinvolved_events'),
    it overrides the default for the source_type.
    """
    import importlib

    # Allow parser_name override for special cases
    key = source_type
    if parser_name and parser_name in _REGISTRY:
        key = parser_name

    if key not in _REGISTRY:
        raise ValueError(f"Unknown source type: {key}")

    module_path, func_name = _REGISTRY[key].rsplit(":", 1)
    module = importlib.import_module(module_path)
    return getattr(module, func_name)
