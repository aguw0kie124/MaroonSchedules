from pydantic import BaseModel, model_validator
import bleach
from typing import Any

class SanitizedBaseModel(BaseModel):
    """
    Base model that automatically strips HTML tags from all string input fields
    to prevent XSS and other injection attacks.
    """
    @model_validator(mode='before')
    @classmethod
    def sanitize_strings(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key, value in data.items():
                if isinstance(value, str):
                    data[key] = bleach.clean(value, tags=[], strip=True)
        return data
