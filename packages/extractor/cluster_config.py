"""Configuration and validation for the Ray Serve extractor cluster."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import re
from typing import Any, Dict, Mapping, Tuple

import yaml


INGRESS_RESOURCE = "extractor_ingress"
MODEL_RESOURCE_PREFIX = "extractor_slot_"
SUPPORTED_IMPLEMENTATIONS = frozenset({"clip", "dino", "omni", "openclip", "qwen"})
SUPPORTED_MODALITIES = frozenset(
    {"image", "text", "video", "image+text", "video+audio"}
)
DEFAULT_BATCH_SIZES = {
    "clip": {"image": 32, "text": 32},
    "dino": {"image": 32},
    "openclip": {"image": 32, "text": 32},
    "qwen": {"image": 32, "text": 32, "image+text": 32, "video": 2},
    "omni": {
        "text": 32,
        "image": 32,
        "image+text": 32,
        "video": 4,
        "video+audio": 4,
    },
}
DEFAULT_IMAGE_LOADING = {
    "download_concurrency": 16,
    "decode_concurrency": 4,
}
_RESOURCE_COMPONENT = re.compile(r"[^A-Za-z0-9_]")
_ENDPOINT_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*$")


class ClusterConfigError(ValueError):
    """Raised when an extractor cluster manifest is invalid."""


def _mapping(value: Any, location: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ClusterConfigError(f"{location} must be a mapping")
    return value


def _positive_number(value: Any, location: str, *, allow_zero: bool = False) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ClusterConfigError(f"{location} must be a number")
    number = float(value)
    if number < 0 or (number == 0 and not allow_zero):
        qualifier = "non-negative" if allow_zero else "positive"
        raise ClusterConfigError(f"{location} must be {qualifier}")
    return number


def _resource_count(value: Any, location: str, *, allow_zero: bool = False) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ClusterConfigError(f"{location} must be an integer")
    if value < 0 or (value == 0 and not allow_zero):
        qualifier = "non-negative" if allow_zero else "positive"
        raise ClusterConfigError(f"{location} must be {qualifier}")
    return value


def _positive_integer(value: Any, location: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ClusterConfigError(f"{location} must be a positive integer")
    return value


def model_resource_name(endpoint: str) -> str:
    """Return the custom Ray resource used to place one model replica."""
    component = _RESOURCE_COMPONENT.sub("_", endpoint)
    return f"{MODEL_RESOURCE_PREFIX}{component}"


@dataclass(frozen=True)
class ModelSpec:
    endpoint: str
    implementation: str
    model_name: str
    modalities: Tuple[str, ...]
    batch_sizes: Mapping[str, int]
    image_loading: Mapping[str, int]
    num_cpus: float
    num_gpus: float
    max_ongoing_requests: int

    @classmethod
    def from_mapping(cls, endpoint: str, raw: Mapping[str, Any]) -> "ModelSpec":
        if endpoint == "status" or not _ENDPOINT_NAME.fullmatch(endpoint):
            raise ClusterConfigError(
                f"models.{endpoint} must be a URL-safe endpoint name and cannot "
                "use the reserved name 'status'"
            )
        implementation = str(raw.get("implementation", "")).strip().lower()
        if implementation not in SUPPORTED_IMPLEMENTATIONS:
            choices = ", ".join(sorted(SUPPORTED_IMPLEMENTATIONS))
            raise ClusterConfigError(
                f"models.{endpoint}.implementation must be one of: {choices}"
            )

        model_name = str(raw.get("model_name", "")).strip()
        if not model_name:
            raise ClusterConfigError(f"models.{endpoint}.model_name must not be empty")

        modalities_raw = raw.get("modalities")
        if not isinstance(modalities_raw, list) or not modalities_raw:
            raise ClusterConfigError(
                f"models.{endpoint}.modalities must be a non-empty list"
            )
        modalities = tuple(str(item) for item in modalities_raw)
        unsupported = sorted(set(modalities) - SUPPORTED_MODALITIES)
        if unsupported:
            raise ClusterConfigError(
                f"models.{endpoint}.modalities contains unsupported values: "
                f"{', '.join(unsupported)}"
            )
        unsupported_by_implementation = sorted(
            set(modalities) - set(DEFAULT_BATCH_SIZES[implementation])
        )
        if unsupported_by_implementation:
            raise ClusterConfigError(
                f"models.{endpoint}.implementation '{implementation}' does not "
                f"support modalities: {', '.join(unsupported_by_implementation)}"
            )

        batch_sizes_raw = _mapping(
            raw.get("batch_sizes", {}), f"models.{endpoint}.batch_sizes"
        )
        unknown_batch_modalities = sorted(
            str(modality)
            for modality in batch_sizes_raw
            if str(modality) not in modalities
        )
        if unknown_batch_modalities:
            raise ClusterConfigError(
                f"models.{endpoint}.batch_sizes contains modalities not declared "
                f"by the model: {', '.join(unknown_batch_modalities)}"
            )
        configured_batch_sizes = {
            str(modality): _positive_integer(
                value, f"models.{endpoint}.batch_sizes.{modality}"
            )
            for modality, value in batch_sizes_raw.items()
        }
        batch_sizes = {
            modality: configured_batch_sizes.get(
                modality, DEFAULT_BATCH_SIZES[implementation][modality]
            )
            for modality in modalities
        }

        image_loading_raw = _mapping(
            raw.get("image_loading", {}), f"models.{endpoint}.image_loading"
        )
        unknown_image_loading_keys = sorted(
            str(key)
            for key in image_loading_raw
            if str(key) not in DEFAULT_IMAGE_LOADING
        )
        if unknown_image_loading_keys:
            raise ClusterConfigError(
                f"models.{endpoint}.image_loading contains unknown keys: "
                f"{', '.join(unknown_image_loading_keys)}"
            )
        image_loading = {
            key: _positive_integer(
                image_loading_raw.get(key, default),
                f"models.{endpoint}.image_loading.{key}",
            )
            for key, default in DEFAULT_IMAGE_LOADING.items()
        }

        resources = _mapping(raw.get("resources", {}), f"models.{endpoint}.resources")
        num_cpus = _positive_number(
            resources.get("num_cpus", 1), f"models.{endpoint}.resources.num_cpus"
        )
        num_gpus = _positive_number(
            resources.get("num_gpus", 0),
            f"models.{endpoint}.resources.num_gpus",
            allow_zero=True,
        )

        max_ongoing_requests = raw.get("max_ongoing_requests", 100)
        if (
            isinstance(max_ongoing_requests, bool)
            or not isinstance(max_ongoing_requests, int)
            or max_ongoing_requests <= 0
        ):
            raise ClusterConfigError(
                f"models.{endpoint}.max_ongoing_requests must be a positive integer"
            )

        return cls(
            endpoint=endpoint,
            implementation=implementation,
            model_name=model_name,
            modalities=modalities,
            batch_sizes=batch_sizes,
            image_loading=image_loading,
            num_cpus=num_cpus,
            num_gpus=num_gpus,
            max_ongoing_requests=max_ongoing_requests,
        )

    @property
    def deployment_name(self) -> str:
        return f"Extractor_{_RESOURCE_COMPONENT.sub('_', self.endpoint)}"

    def router_config(self, assigned_nodes: Tuple[str, ...]) -> Dict[str, Any]:
        return {
            "name": self.model_name,
            "modalities": list(self.modalities),
            "batch_sizes": dict(self.batch_sizes),
            "image_loading": dict(self.image_loading),
            "deployment": self.deployment_name,
            "desired_replicas": len(assigned_nodes),
            "assigned_nodes": list(assigned_nodes),
        }


@dataclass(frozen=True)
class NodeSpec:
    node_id: str
    address: str
    num_cpus: int
    num_gpus: int
    models: Tuple[str, ...]

    @classmethod
    def from_mapping(cls, node_id: str, raw: Mapping[str, Any]) -> "NodeSpec":
        address = str(raw.get("address", "")).strip()
        if not address:
            raise ClusterConfigError(f"nodes.{node_id}.address must not be empty")

        num_cpus = _resource_count(
            raw.get("num_cpus", 1), f"nodes.{node_id}.num_cpus"
        )
        num_gpus = _resource_count(
            raw.get("num_gpus", 0),
            f"nodes.{node_id}.num_gpus",
            allow_zero=True,
        )
        models_raw = raw.get("models", [])
        if not isinstance(models_raw, list):
            raise ClusterConfigError(f"nodes.{node_id}.models must be a list")
        models = tuple(str(item) for item in models_raw)
        if len(models) != len(set(models)):
            raise ClusterConfigError(
                f"nodes.{node_id}.models cannot contain the same model twice"
            )
        return cls(node_id, address, num_cpus, num_gpus, models)


@dataclass(frozen=True)
class ClusterSpec:
    source_path: Path
    head_node: str
    ray_port: int
    dashboard_port: int
    dashboard_host: str
    http_host: str
    http_port: int
    cuda_cleanup_interval_seconds: int
    nodes: Mapping[str, NodeSpec]
    models: Mapping[str, ModelSpec]

    @property
    def head(self) -> NodeSpec:
        return self.nodes[self.head_node]

    def assigned_nodes(self, endpoint: str) -> Tuple[str, ...]:
        return tuple(
            node_id for node_id, node in self.nodes.items() if endpoint in node.models
        )

    def replica_count(self, endpoint: str) -> int:
        return len(self.assigned_nodes(endpoint))

    def node_resources(self, node_id: str) -> Dict[str, float]:
        node = self.nodes[node_id]
        resources = {
            model_resource_name(endpoint): 1.0 for endpoint in node.models
        }
        if node_id == self.head_node:
            resources[INGRESS_RESOURCE] = 1.0
        return resources

    def ray_address(self) -> str:
        return f"{self.head.address}:{self.ray_port}"

    def dashboard_address(self) -> str:
        return f"http://{self.head.address}:{self.dashboard_port}"

    def summary(self) -> str:
        data = {
            "head_node": self.head_node,
            "ray_address": self.ray_address(),
            "http_address": f"http://{self.head.address}:{self.http_port}",
            "cuda_cleanup_interval_seconds": self.cuda_cleanup_interval_seconds,
            "nodes": {
                node_id: {
                    "address": node.address,
                    "models": list(node.models),
                    "resources": self.node_resources(node_id),
                }
                for node_id, node in self.nodes.items()
            },
            "replicas": {
                endpoint: self.replica_count(endpoint) for endpoint in self.models
            },
        }
        return json.dumps(data, indent=2, sort_keys=True)


def _port(value: Any, location: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 65535:
        raise ClusterConfigError(f"{location} must be an integer between 1 and 65535")
    return value


def load_cluster_config(path: str | Path) -> ClusterSpec:
    """Load and fully validate an extractor cluster manifest."""
    source_path = Path(path).expanduser().resolve()
    try:
        raw = yaml.safe_load(source_path.read_text(encoding="utf-8"))
    except OSError as exc:
        raise ClusterConfigError(
            f"cannot read cluster manifest {source_path}: {exc}"
        ) from exc
    except yaml.YAMLError as exc:
        raise ClusterConfigError(f"invalid YAML in {source_path}: {exc}") from exc

    root = _mapping(raw, "manifest")
    cluster = _mapping(root.get("cluster", {}), "cluster")
    head_node = str(cluster.get("head_node", "head"))
    ray_port = _port(cluster.get("ray_port", 6379), "cluster.ray_port")
    dashboard_port = _port(
        cluster.get("dashboard_port", 8265), "cluster.dashboard_port"
    )
    http_port = _port(cluster.get("http_port", 8000), "cluster.http_port")
    dashboard_host = str(cluster.get("dashboard_host", "0.0.0.0"))
    http_host = str(cluster.get("http_host", "0.0.0.0"))
    cuda_cleanup_interval_seconds = _resource_count(
        cluster.get("cuda_cleanup_interval_seconds", 60),
        "cluster.cuda_cleanup_interval_seconds",
        allow_zero=True,
    )

    models_raw = _mapping(root.get("models", {}), "models")
    if not models_raw:
        raise ClusterConfigError("models must contain at least one model")
    models = {
        str(endpoint): ModelSpec.from_mapping(
            str(endpoint), _mapping(value, f"models.{endpoint}")
        )
        for endpoint, value in models_raw.items()
    }
    resource_names = [model_resource_name(endpoint) for endpoint in models]
    if len(resource_names) != len(set(resource_names)):
        raise ClusterConfigError(
            "model endpoint names produce conflicting Ray custom resource names"
        )

    nodes_raw = _mapping(root.get("nodes", {}), "nodes")
    if not nodes_raw:
        raise ClusterConfigError("nodes must contain at least one node")
    nodes = {
        str(node_id): NodeSpec.from_mapping(
            str(node_id), _mapping(value, f"nodes.{node_id}")
        )
        for node_id, value in nodes_raw.items()
    }
    if head_node not in nodes:
        raise ClusterConfigError(f"cluster.head_node '{head_node}' is not in nodes")
    addresses = [node.address for node in nodes.values()]
    if len(addresses) != len(set(addresses)):
        raise ClusterConfigError("every node must have a unique address")

    for node_id, node in nodes.items():
        unknown_models = sorted(set(node.models) - set(models))
        if unknown_models:
            raise ClusterConfigError(
                f"nodes.{node_id}.models contains unknown models: "
                f"{', '.join(unknown_models)}"
            )
        allocated_cpus = sum(models[name].num_cpus for name in node.models)
        if node_id == head_node:
            allocated_cpus += 0.1
        allocated_gpus = sum(models[name].num_gpus for name in node.models)
        if allocated_cpus > node.num_cpus:
            raise ClusterConfigError(
                f"nodes.{node_id} allocates {allocated_cpus:g} CPUs but exposes "
                f"{node.num_cpus:g}"
            )
        if allocated_gpus > node.num_gpus:
            raise ClusterConfigError(
                f"nodes.{node_id} allocates {allocated_gpus:g} GPUs but exposes "
                f"{node.num_gpus:g}"
            )

    unassigned = sorted(
        endpoint
        for endpoint in models
        if not any(endpoint in node.models for node in nodes.values())
    )
    if unassigned:
        raise ClusterConfigError(
            f"every model must be assigned to at least one node: {', '.join(unassigned)}"
        )

    return ClusterSpec(
        source_path=source_path,
        head_node=head_node,
        ray_port=ray_port,
        dashboard_port=dashboard_port,
        dashboard_host=dashboard_host,
        http_host=http_host,
        http_port=http_port,
        cuda_cleanup_interval_seconds=cuda_cleanup_interval_seconds,
        nodes=nodes,
        models=models,
    )
