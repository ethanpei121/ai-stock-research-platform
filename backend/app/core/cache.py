from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from time import monotonic
from typing import Generic, TypeVar


T = TypeVar("T")


@dataclass
class CacheEntry(Generic[T]):
    value: T
    expires_at: float


class TTLCache(Generic[T]):
    def __init__(self, ttl_seconds: int) -> None:
        self.ttl_seconds = ttl_seconds
        self._entries: dict[str, CacheEntry[T]] = {}
        self._lock = Lock()

    def get(self, key: str) -> T | None:
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= monotonic():
                self._entries.pop(key, None)
                return None
            return entry.value

    def set(self, key: str, value: T) -> T:
        with self._lock:
            self._entries[key] = CacheEntry(
                value=value,
                expires_at=monotonic() + self.ttl_seconds,
            )
        return value

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()
