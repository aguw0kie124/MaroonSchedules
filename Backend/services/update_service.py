from typing import Dict, Any
from repositories import update_repository

def get_app_version_config() -> Dict[str, Dict[str, str]]:
    """
    Retrieves the version configuration and structures it by platform.
    
    Returns:
        {
            "ios": {
                "latestVersion": "1.0.0",
                "minimumSupportedVersion": "1.0.0",
                "storeUrl": "..."
            },
            "android": {
                ...
            }
        }
    """
    rows = update_repository.get_version_config()
    
    config = {}
    for row in rows:
        platform = row["platform"]
        config[platform] = {
            "latestVersion": row["latest_version"],
            "minimumSupportedVersion": row["minimum_supported_version"],
            "storeUrl": row["store_url"]
        }
    
    return config
