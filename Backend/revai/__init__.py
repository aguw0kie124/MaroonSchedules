"""RevAI campus assistant — public package surface.

Everything else in the backend should import `answer_question` from here
rather than reaching into revai's submodules directly.
"""

from __future__ import annotations

from .dispatch import answer_question

__all__ = ["answer_question"]
