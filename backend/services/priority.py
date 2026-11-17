from abc import ABC, abstractmethod


class PriorityStrategy(ABC):
    @abstractmethod
    def calculate(self, description: str, category: str) -> str:
        ...


class KeywordPriorityStrategy(PriorityStrategy):
    P1_KEYWORDS = [
        "payroll", "outage", "crash", "down", "security breach",
        "data loss", "database", "production", "critical", "emergency",
    ]
    P2_KEYWORDS = [
        "finance", "billing", "hr", "slow", "performance",
        "intermittent", "login", "access denied",
    ]
    P3_KEYWORDS = [
        "error", "bug", "issue", "problem", "not working", "failed",
    ]

    def calculate(self, description: str, category: str) -> str:
        text = description.lower()
        if any(k in text for k in self.P1_KEYWORDS):
            return "P1"
        if any(k in text for k in self.P2_KEYWORDS):
            return "P2"
        if any(k in text for k in self.P3_KEYWORDS):
            return "P3"
        return "P4"
