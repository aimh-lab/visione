"""Ray Serve application for the multi-model feature extractor."""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
import time
from typing import Any, Dict, Mapping

from native_runtime import preload_conda_native_libs


preload_conda_native_libs()

import ray
from ray import serve
from ray.serve.handle import DeploymentHandle

from cluster_config import (
    ClusterSpec,
    INGRESS_RESOURCE,
    load_cluster_config,
    model_resource_name,
)
from endpoints.openclip import OpenCLIPFeatureExtractor
from endpoints.clip import CLIPFeatureExtractor
from endpoints.qwen import QwenFeatureExtractor
from endpoints.dino import DINOFeatureExtractor
from endpoints.omni import OmniFeatureExtractor


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ray.serve")

MEDIA_FIELDS = frozenset({"image", "text", "video", "audio"})
MODALITY_ROUTES = {
    frozenset({"image"}): ("image", "extract_image"),
    frozenset({"text"}): ("text", "extract_text"),
    frozenset({"video"}): ("video", "extract_video"),
    frozenset({"image", "text"}): ("image+text", "extract_image_text"),
    frozenset({"video", "audio"}): ("video+audio", "extract_video_audio"),
}
IMPLEMENTATIONS = {
    "clip": CLIPFeatureExtractor,
    "dino": DINOFeatureExtractor,
    "omni": OmniFeatureExtractor,
    "openclip": OpenCLIPFeatureExtractor,
    "qwen": QwenFeatureExtractor,
}
DEFAULT_CONFIG = Path(__file__).with_name("extractor-cluster.yaml")


def resolve_request_modality(data: Dict[str, Any]) -> tuple[str, str]:
    """Return the declared modality and deployment method for a request body."""
    if not isinstance(data, dict):
        raise ValueError("Il corpo della richiesta deve essere un oggetto JSON")

    provided_media_fields = frozenset(data.keys()) & MEDIA_FIELDS
    route = MODALITY_ROUTES.get(provided_media_fields)
    if route is None:
        fields = ", ".join(sorted(provided_media_fields)) or "nessuno"
        raise ValueError(f"Combinazione di modalità non supportata: {fields}")
    return route


def _serialize_serve_status(status: Any) -> Any:
    """Convert Ray's status dataclasses/enums to JSON-compatible values."""
    if status is None or isinstance(status, (str, int, float, bool)):
        return status
    if isinstance(status, Mapping):
        return {
            str(key): _serialize_serve_status(value) for key, value in status.items()
        }
    if isinstance(status, (list, tuple, set)):
        return [_serialize_serve_status(value) for value in status]
    if hasattr(status, "value"):
        return _serialize_serve_status(status.value)
    if hasattr(status, "model_dump"):
        return _serialize_serve_status(status.model_dump())
    if hasattr(status, "dict"):
        return _serialize_serve_status(status.dict())
    if hasattr(status, "__dict__"):
        return {
            key: _serialize_serve_status(value)
            for key, value in vars(status).items()
            if not key.startswith("_")
        }
    return str(status)


def _deployment_capacity(
    serve_status: Any, deployment_name: str, desired_replicas: int
) -> Dict[str, Any]:
    """Extract a stable capacity summary from Ray's versioned status payload."""
    applications = (
        serve_status.get("applications", {}) if isinstance(serve_status, dict) else {}
    )
    application = applications.get("extractor", {})
    deployments = (
        application.get("deployments", {}) if isinstance(application, dict) else {}
    )
    deployment = deployments.get(deployment_name, {})
    replica_states = (
        deployment.get("replica_states", {}) if isinstance(deployment, dict) else {}
    )
    healthy_replicas = 0
    if isinstance(replica_states, dict):
        healthy_replicas = sum(
            int(count)
            for state, count in replica_states.items()
            if str(state).upper().endswith("RUNNING")
        )
    return {
        "desired_replicas": desired_replicas,
        "healthy_replicas": healthy_replicas,
        "pending_replicas": max(desired_replicas - healthy_replicas, 0),
        "deployment_status": (
            deployment.get("status", "UNKNOWN")
            if isinstance(deployment, dict)
            else "UNKNOWN"
        ),
    }


@serve.deployment(
    num_replicas=1,
    ray_actor_options={
        "num_cpus": 0.1,
        "resources": {INGRESS_RESOURCE: 1.0},
    },
    max_ongoing_requests=1000,
)
class ModelRouter:
    """HTTP ingress that dispatches each endpoint to its model deployment."""

    def __init__(
        self,
        model_handles: Dict[str, DeploymentHandle],
        models_config: Dict[str, Dict[str, Any]],
    ):
        self.models_config = models_config
        self.model_handles = model_handles
        self.start_time = time.time()

    async def __call__(self, request) -> Dict[str, Any]:
        try:
            path = request.url.path
            model_endpoint = path.rstrip("/").split("/")[-1]

            if model_endpoint == "status":
                return self.get_status()

            if model_endpoint not in self.model_handles:
                available_models = list(self.models_config.keys())
                return {
                    "error": f"Modello '{model_endpoint}' non disponibile. "
                    f"Modelli disponibili: {available_models}",
                    "available_models": available_models,
                }

            data = await request.json() if hasattr(request, "json") else request
            try:
                modality, method_name = resolve_request_modality(data)
            except ValueError as exc:
                return {"error": str(exc)}

            supported_modalities = self.models_config[model_endpoint]["modalities"]
            if modality not in supported_modalities:
                return {
                    "error": f"Il modello '{model_endpoint}' non supporta "
                    f"la modalità '{modality}'"
                }

            method_handle = getattr(self.model_handles[model_endpoint], method_name)
            return await method_handle.remote(data)
        except Exception as exc:
            logger.exception("Errore nel router")
            return {"error": f"Errore interno del server: {exc}"}

    def get_status(self) -> Dict[str, Any]:
        try:
            serve_status = _serialize_serve_status(serve.status())
            models = {}
            for endpoint, model_info in self.models_config.items():
                capacity = _deployment_capacity(
                    serve_status,
                    model_info["deployment"],
                    model_info["desired_replicas"],
                )
                models[endpoint] = {
                    "model_infos": model_info,
                    "endpoint": f"/{endpoint}",
                    "replica_policy": "fixed_warm",
                    **capacity,
                }
            degraded = any(model["pending_replicas"] > 0 for model in models.values())
            return {
                "status": "degraded" if degraded else "running",
                "router_uptime": time.time() - self.start_time,
                "models": models,
                "deployments_status": serve_status,
            }
        except Exception as exc:
            logger.exception("Unable to retrieve Serve status")
            return {"error": f"Errore nel recupero status: {exc}"}


def build_application_from_config(config: ClusterSpec):
    """Build the Serve DAG with one deployment per configured model."""
    model_handles: Dict[str, Any] = {}
    models_config: Dict[str, Dict[str, Any]] = {}

    for endpoint, model in config.models.items():
        assigned_nodes = config.assigned_nodes(endpoint)
        deployment = IMPLEMENTATIONS[model.implementation]
        actor_options = {
            "num_cpus": model.num_cpus,
            "num_gpus": model.num_gpus,
            "resources": {model_resource_name(endpoint): 1.0},
        }
        model_handles[endpoint] = deployment.options(
            name=model.deployment_name,
            num_replicas=len(assigned_nodes),
            ray_actor_options=actor_options,
            max_ongoing_requests=model.max_ongoing_requests,
            user_config={"batch_sizes": dict(model.batch_sizes)},
        ).bind(model_name=model.model_name)
        models_config[endpoint] = model.router_config(assigned_nodes)
        logger.info(
            "Registered %s as %s with %d warm replicas on %s",
            endpoint,
            model.model_name,
            len(assigned_nodes),
            ", ".join(assigned_nodes),
        )

    return ModelRouter.bind(
        model_handles=model_handles,
        models_config=models_config,
    )


def build_app(args: Dict[str, Any]):
    """Ray Serve application builder used by a generated Serve config."""
    config_path = args.get("config_path") if isinstance(args, dict) else None
    return build_application_from_config(
        load_cluster_config(config_path or DEFAULT_CONFIG)
    )


def _connect_or_start_local(config: ClusterSpec, address: str) -> bool:
    """Connect to a cluster, falling back to a manifest-backed local Ray node."""
    try:
        ray.init(address=address)
        logger.info("Connected to Ray cluster at %s", address)
        return False
    except ConnectionError:
        if address != "auto":
            raise

    head = config.head
    logger.info("No Ray cluster found; starting a local single-node Ray runtime")
    ray.init(
        include_dashboard=False,
        num_cpus=head.num_cpus,
        num_gpus=head.num_gpus,
        resources=config.node_resources(config.head_node),
    )
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Multi-node, multi-model feature extractor server"
    )
    parser.add_argument(
        "--config",
        default=os.environ.get("FEATURE_EXTRACTOR_CLUSTER_CONFIG", str(DEFAULT_CONFIG)),
        help="Path to the extractor cluster manifest",
    )
    parser.add_argument(
        "--address",
        default=os.environ.get("RAY_ADDRESS", "auto"),
        help="Ray cluster address; 'auto' falls back to a local single-node runtime",
    )
    parser.add_argument("--host", help="Override the manifest HTTP bind host")
    parser.add_argument("--port", type=int, help="Override the manifest HTTP port")
    args = parser.parse_args()

    config = load_cluster_config(args.config)
    started_local = _connect_or_start_local(config, args.address)
    http_host = args.host or config.http_host
    http_port = args.port or config.http_port

    serve.start(
        proxy_location="HeadOnly",
        http_options={"host": http_host, "port": http_port},
    )
    serve.run(
        build_application_from_config(config),
        name="extractor",
        route_prefix="/",
    )

    logger.info(
        "Feature extractor is running at http://%s:%d (%s)",
        http_host,
        http_port,
        "local Ray runtime" if started_local else config.ray_address(),
    )
    try:
        while True:
            time.sleep(10)
    except KeyboardInterrupt:
        logger.info("Stopping feature extractor driver")


if __name__ == "__main__":
    main()
