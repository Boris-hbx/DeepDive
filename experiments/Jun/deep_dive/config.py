import os
import json
from pathlib import Path

def load_config():
    config_path = Path(__file__).parent.parent / "config.json"
    with open(config_path) as f:
        return json.load(f)

def get_env(key: str, default: str = None) -> str:
    return os.getenv(key, default)

def get_user_config_path():
    """获取用户配置文件路径（不提交到 git）"""
    return Path(__file__).parent.parent / "user_config.json"

def load_user_config() -> dict:
    """加载用户配置"""
    path = get_user_config_path()
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}

def save_user_config(config: dict):
    """保存用户配置"""
    path = get_user_config_path()
    with open(path, "w") as f:
        json.dump(config, f, indent=2)