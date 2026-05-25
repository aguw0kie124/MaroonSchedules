"""Parser registry — maps source types/parser names to parser callables."""

from __future__ import annotations

from typing import Callable, Dict

_TYPE_REGISTRY: Dict[str, str] = {
    "livewhale_json": "parsers.livewhale:parse_livewhale",
    "rss_directory": "parsers.rss:parse_rss_directory",
    "html": "parsers.getinvolved:parse_getinvolved_events",
    "html_pagination": "parsers.getinvolved:parse_getinvolved_orgs",
    "html_search": "parsers.getinvolved:parse_getinvolved_search",
    "html_dynamic_table": "parsers.ers:parse_ers_events_list",
    # Back-compat source type aliases used in sources.yaml.
    "html_events": "parsers.html_generic:parse_html_events",
    "html_multi_url": "parsers.html_generic:parse_html_multi_url",
}

_NAME_REGISTRY: Dict[str, str] = {
    "getinvolved_events": "parsers.getinvolved:parse_getinvolved_events",
    "getinvolved_orgs": "parsers.getinvolved:parse_getinvolved_orgs",
    "getinvolved_search": "parsers.getinvolved:parse_getinvolved_search",
    "ers_events_list": "parsers.ers:parse_ers_events_list",
    "html_events": "parsers.html_generic:parse_html_events",
    "html_multi_url": "parsers.html_generic:parse_html_multi_url",
}


def _resolve_callable(spec: str) -> Callable:
    import importlib

    module_path, func_name = spec.rsplit(":", 1)
    module = importlib.import_module(module_path)
    return getattr(module, func_name)


def get_parser(source_type: str, parser_name: str | None = None) -> Callable:
    """Return the parser callable for a given source type/parser override."""
    # Explicit parser override from sources.yaml takes precedence.
    if parser_name:
        override = _NAME_REGISTRY.get(parser_name)
        if not override:
            raise ValueError(f"Unknown parser override: {parser_name}")
        return _resolve_callable(override)

    spec = _TYPE_REGISTRY.get(source_type)
    if not spec:
        raise ValueError(f"Unknown source type: {source_type}")

    return _resolve_callable(spec)
