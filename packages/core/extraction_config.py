from dataclasses import dataclass
from typing import Any, Iterable, Optional


def _config_get(config: Any, key: str, default: Any = None) -> Any:
    """Read a field from a dict or an OmegaConf-style config node."""
    if config is None:
        return default
    if hasattr(config, "get"):
        return config.get(key, default)
    return getattr(config, key, default)


def normalize_modality_for_column(modality: str) -> str:
    """Return the stable SQL/public-name representation of a modality."""
    return modality.replace("+", "_")


def collection_element_type(modality: str) -> str:
    """Map an embedding modality to the collection element served by the loader."""
    return "video" if "video" in modality else modality


@dataclass(frozen=True)
class ExtractionSpec:
    model: str
    modality: str
    dim: int
    mrl_dim: Optional[int] = None

    @property
    def public_name(self) -> str:
        return f"{self.model}_{normalize_modality_for_column(self.modality)}"

    @property
    def native_column(self) -> str:
        return self.public_name

    @property
    def searchable_column(self) -> str:
        if self.mrl_dim:
            return f"{self.native_column}_MRL{self.mrl_dim}"
        return self.native_column


def resolve_extraction_specs(
    loader_config: Any,
    embedding_config: Any,
) -> list[ExtractionSpec]:
    """Merge collection extraction selections with the common model registry."""
    extractions: Iterable[Any] = _config_get(loader_config, "extraction", []) or []
    model_configs: Iterable[Any] = _config_get(embedding_config, "models", []) or []

    registry: dict[str, Any] = {}
    for model_config in model_configs:
        model_name = _config_get(model_config, "name")
        if not model_name:
            raise ValueError("Every embedding model configuration requires a non-empty 'name'")
        if model_name in registry:
            raise ValueError(f"Duplicate embedding model configuration: {model_name}")
        registry[model_name] = model_config

    specs: list[ExtractionSpec] = []
    seen: set[tuple[str, str]] = set()
    for extraction in extractions:
        model_name = _config_get(extraction, "model")
        modality = _config_get(extraction, "modality")
        if not isinstance(model_name, str) or not model_name.strip():
            raise ValueError("Every extraction requires a non-empty 'model'")
        if not isinstance(modality, str) or not modality.strip():
            raise ValueError("Every extraction requires a non-empty 'modality'")

        model_name = model_name.strip()
        modality = modality.strip()
        pair = (model_name, modality)
        if pair in seen:
            raise ValueError(
                f"Duplicate extraction configuration: model={model_name}, modality={modality}"
            )
        seen.add(pair)

        model_config = registry.get(model_name)
        if model_config is None:
            raise ValueError(
                f"Extraction model '{model_name}' is not defined in embedding.models"
            )

        dim = _config_get(model_config, "dim")
        if not isinstance(dim, int) or isinstance(dim, bool) or dim <= 0:
            raise ValueError(f"Model '{model_name}' requires a positive integer 'dim'")

        mrl_dim = _config_get(model_config, "mrl_dim")
        if mrl_dim is None:
            mrl_dim = _config_get(model_config, "mrl_dim_serve")
        if mrl_dim is not None and (
            not isinstance(mrl_dim, int)
            or isinstance(mrl_dim, bool)
            or mrl_dim <= 0
            or mrl_dim > dim
        ):
            raise ValueError(
                f"Model '{model_name}' has invalid mrl_dim={mrl_dim} for dim={dim}"
            )

        specs.append(
            ExtractionSpec(
                model=model_name,
                modality=modality,
                dim=dim,
                mrl_dim=mrl_dim,
            )
        )

    public_names = [spec.public_name for spec in specs]
    if len(public_names) != len(set(public_names)):
        raise ValueError("Extraction configurations produce duplicate public/column names")

    return specs
