from abc import ABC, abstractmethod

class LLMClient(ABC):
    @abstractmethod
    def complete(self, prompt: str, system: str = None) -> str:
        """同步补全，返回文本"""
        raise NotImplementedError

    @abstractmethod
    def complete_with_json(self, prompt: str, system: str = None) -> dict:
        """返回 JSON 结构化结果"""
        raise NotImplementedError