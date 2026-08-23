# Feature extractor service

The extractor can run unchanged on one DGX Spark or on a bare-metal Ray
cluster. The public API remains:

- `POST /<model-endpoint>` for extraction requests.
- `GET /status` for the model catalog and Ray Serve state.

Ray Serve routes each request to an available replica of the selected model.
When the same endpoint is assigned to several nodes, Serve's default
queue-aware router balances requests among those replicas.

## Install

Install the same Python environment and checkout on every node:

```bash
cd packages/extractor
python -m pip install -r requirements.txt
```

All nodes must use the same Python, Ray, CUDA, PyTorch, Transformers, and
project revisions. The current Ray pin provides Linux aarch64 wheels for DGX
Spark.

## Single node

The default [`extractor-cluster.yaml`](extractor-cluster.yaml) assigns every
model to the head. No separate Ray startup command is required:

```bash
cd packages/extractor
python server.py
```

`server.py` connects to an existing Ray cluster when one is running. Otherwise,
it creates a local Ray runtime using the head resources and assignments from
the manifest.

Validate the configuration before loading the models:

```bash
python cluster_admin.py validate
```

## Multiple nodes

Edit `extractor-cluster.yaml` and give each machine a stable, reachable
address. Assign models under each node. Repeating a model on several nodes
creates several warm replicas; assigning several different models to a node
shares that node's GPU according to their configured fractions.

For example:

```yaml
nodes:
  head:
    address: 192.168.1.10
    num_cpus: 20
    num_gpus: 1
    models: [qwen_embedding_8B, dinov2_base]
  spark-02:
    address: 192.168.1.11
    num_cpus: 20
    num_gpus: 1
    models: [qwen_embedding_8B, omni_embed_nemotron_3B]
```

This creates two `qwen_embedding_8B` replicas and one replica of each other
listed model. Assign or remove the remaining model-catalog entries as needed;
the validator requires every declared model to have at least one assignment
and rejects CPU/GPU over-allocation.

Run the following from `packages/extractor` in the same checkout path on every
machine. Start the head on the configured head:

```bash
python cluster_admin.py start-node --node head
```

Start each worker on its corresponding machine:

```bash
python cluster_admin.py start-node --node spark-02
```

The exact native Ray command can be inspected without executing it:

```bash
python cluster_admin.py print-start-command --node spark-02
```

Finally, deploy from the head:

```bash
python cluster_admin.py deploy
serve status --address http://192.168.1.10:8265
```

Only the head runs the HTTP proxy. The head may also run models and is the
default compute node in the single-node configuration. If a worker disappears,
models duplicated elsewhere keep serving new requests. The head remains a
single control-plane and ingress dependency.

Ray requires bidirectional network connectivity between nodes. The Ray, object
manager, node manager, dashboard, and worker port ranges must be allowed by the
host firewall. For a restricted network, add explicit Ray port flags to the
generated startup commands.

## HTTP cache

The requests cache is disabled by default and no cache database is created.
Enable it before starting Ray only when needed:

```bash
export FEATURE_EXTRACTOR_CACHE_ENABLED=1
export FEATURE_EXTRACTOR_CACHE_TTL_SECONDS=60
export FEATURE_EXTRACTOR_CACHE_DIR=/tmp
```

Every replica uses a cache file containing its hostname and process ID, so
several replicas never share one SQLite database. The former
`FEATURE_EXTRACTOR_DISABLE_CACHE` variable is obsolete.

## CUDA memory cleanup

Every GPU replica periodically releases unused PyTorch allocator cache at a
completed batch boundary. The default interval is 60 seconds and can be set in
the cluster manifest; use `0` to disable periodic cleanup:

```yaml
cluster:
  cuda_cleanup_interval_seconds: 60
```

A detected CUDA out-of-memory error always requests cleanup at the end of the
failed batch, even when periodic cleanup is disabled. Cleanup releases only
unused cached and request-local allocations. Warm model weights remain resident,
so models whose weights do not fit together must be assigned to different GPUs
or loaded with a lower-memory configuration.

## Updating the topology

After changing assignments or model resources:

1. Run `python cluster_admin.py validate`.
2. Restart any Ray nodes whose advertised model slots changed.
3. Run `python cluster_admin.py deploy` again.

Serve applies the new fixed replica counts. A replica remains pending when its
assigned model slot is unavailable and starts automatically when a matching
node rejoins the cluster.

## Request batching

Each model endpoint can set a maximum batch size independently for every
declared modality:

```yaml
models:
  qwen_embedding_8B:
    implementation: qwen
    model_name: Qwen/Qwen3-VL-Embedding-8B
    modalities: [image, text, image+text, video]
    batch_sizes:
      image: 16
      text: 64
      image+text: 16
      video: 2
    resources:
      num_cpus: 4
      num_gpus: 0.1
    max_ongoing_requests: 64
```

Omitted sizes use the implementation's existing defaults. Batch sizes are
applied independently to each replica. Deploying a batch-size-only change uses
Ray Serve reconfiguration and does not reload the model.

`max_ongoing_requests` is not adjusted automatically. It should be at least the
largest configured batch size because, with the default single concurrent
batch, a replica cannot fill a larger batch than its request admission limit.
The batch wait timeout remains 0.1 seconds.

Image-capable endpoints load each replica batch concurrently. The two limits
can be tuned independently per model:

```yaml
models:
  dinov2_base:
    # ...
    image_loading:
      download_concurrency: 16
      decode_concurrency: 4
```

The defaults are 16 simultaneous HTTP downloads and 4 simultaneous PIL
decodes per replica. With four image model replicas sharing a node, that
allows at most 64 downloads and 16 decodes on that node at once. Changes are
applied through Serve reconfiguration without reloading the model. The HTTP
timeout remains 10 seconds, and failures remain isolated to their individual
requests.
