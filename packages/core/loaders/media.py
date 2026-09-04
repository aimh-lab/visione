from dataclasses import dataclass


@dataclass(frozen=True)
class MediaResource:
    collection: str
    resource_id: str
    element_type: str
    file_key: str
    file_path: str | None
    media_kind: str
    start_seconds: float | None = None
    end_seconds: float | None = None
