import os
import json
from pathlib import Path

def load_config():
    config_path = Path(__file__).parent.parent / "config.json"
    with open(config_path) as f:
        return json.load(f)

def get_env(key: str, default: str = None) -> str:
    return os.getenv(key, default)