# Media manifest

The dataserver resolves public media URLs through an indexed SQLite manifest.
Nginx never reads collection metadata or filesystem conventions directly.

Build or refresh the manifest from the core environment:

```bash
cd packages/core
.venv/bin/python build_media_manifest.py
```

The command loads `lsc`, `lsc26`, and the combined `v3c` loader, writes a
temporary database, validates it, and atomically replaces
`../dataserver/nginx/generated/media.sqlite`. Missing files are reported and
their endpoints are omitted.

Start the services after the first build:

```bash
cd ../dataserver/nginx
docker compose up --build -d
```

After later manifest refreshes, only the resolver must reopen the database:

```bash
cd ../../core
.venv/bin/python build_media_manifest.py --collection v3c

cd ../dataserver/nginx
docker compose restart media-resolver
```

`--collection` updates only the selected collection in an atomic copy of the
current database. It may be repeated to update multiple collections. Omit it
to rebuild the complete manifest. If the manifest does not exist, a selective
command creates it with only the selected collection or collections; later
selective commands can add or refresh the others.

Each run writes a JSON Lines problem log next to the database as `media.log`.
It includes ignored missing files, invalid video bounds, the final summary, and
failure tracebacks. Use `--log /path/to/build.log` to choose another location.

Canonical V3C URLs are:

```text
/v3c/19826/video
/v3c/19826_534/video
/v3c/19826_534/image
```

Shot-video requests may include a non-negative `tpad` value to extend both
manifest boundaries. For example, `?tpad=1.5` changes `[start, end]` to
`[max(0, start - 1.5), end + 1.5]`. The parameter is ignored for whole videos
and images; invalid values return HTTP 400.
