"""Administrative CLI for a bare-metal extractor Ray cluster."""

from __future__ import annotations

import argparse
import hashlib
import json
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List

import yaml

from cluster_config import ClusterSpec, load_cluster_config


DEFAULT_CONFIG = Path(__file__).with_name("extractor-cluster.yaml")


def ray_start_command(config: ClusterSpec, node_id: str) -> List[str]:
    """Build the exact Ray CLI command for one manifest node."""
    if node_id not in config.nodes:
        available = ", ".join(config.nodes)
        raise ValueError(f"unknown node '{node_id}'; available nodes: {available}")

    node = config.nodes[node_id]
    if node_id == config.head_node:
        command = [
            "ray",
            "start",
            "--head",
            f"--node-ip-address={node.address}",
            f"--port={config.ray_port}",
            f"--dashboard-host={config.dashboard_host}",
            f"--dashboard-port={config.dashboard_port}",
        ]
    else:
        command = [
            "ray",
            "start",
            f"--address={config.ray_address()}",
            f"--node-ip-address={node.address}",
        ]

    command.extend(
        [
            f"--num-cpus={node.num_cpus:g}",
            f"--num-gpus={node.num_gpus:g}",
            "--resources="
            + json.dumps(config.node_resources(node_id), separators=(",", ":")),
        ]
    )
    return command


def serve_config(config: ClusterSpec) -> dict:
    """Generate a Ray Serve config that delegates DAG creation to server.build_app."""
    config_revision = hashlib.sha256(config.source_path.read_bytes()).hexdigest()
    return {
        "proxy_location": "HeadOnly",
        "http_options": {
            "host": config.http_host,
            "port": config.http_port,
        },
        "applications": [
            {
                "name": "extractor",
                "route_prefix": "/",
                "import_path": "server:build_app",
                "args": {
                    "config_path": str(config.source_path),
                    # Make an in-place manifest edit visible to Serve. Without a
                    # content-derived argument, the deploy payload is unchanged
                    # and Serve has no reason to rebuild the application graph.
                    "config_revision": config_revision,
                },
            }
        ],
    }


def _deploy(config: ClusterSpec) -> None:
    generated = serve_config(config)
    with tempfile.NamedTemporaryFile(
        mode="w",
        prefix="extractor-serve-",
        suffix=".yaml",
        encoding="utf-8",
    ) as config_file:
        yaml.safe_dump(generated, config_file, sort_keys=False)
        config_file.flush()
        subprocess.run(
            [
                "serve",
                "deploy",
                "--address",
                config.dashboard_address(),
                config_file.name,
            ],
            check=True,
        )


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help="Path to the central extractor cluster manifest",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("validate", help="Validate and summarize the manifest")

    print_parser = subparsers.add_parser(
        "print-start-command", help="Print the Ray start command for one node"
    )
    print_parser.add_argument("--node", required=True)

    start_parser = subparsers.add_parser(
        "start-node", help="Start the configured Ray head or worker on this machine"
    )
    start_parser.add_argument("--node", required=True)

    subparsers.add_parser(
        "render-serve-config", help="Print the derived Ray Serve configuration"
    )
    subparsers.add_parser(
        "deploy", help="Deploy the extractor application through the Ray dashboard"
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    config = load_cluster_config(args.config)

    if args.command == "validate":
        print(config.summary())
    elif args.command == "print-start-command":
        print(shlex.join(ray_start_command(config, args.node)))
    elif args.command == "start-node":
        subprocess.run(ray_start_command(config, args.node), check=True)
    elif args.command == "render-serve-config":
        yaml.safe_dump(serve_config(config), sys.stdout, sort_keys=False)
    elif args.command == "deploy":
        _deploy(config)


if __name__ == "__main__":
    main()
