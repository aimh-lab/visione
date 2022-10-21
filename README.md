# VISIONE

## Start
### Start VISIONE in deploy mode (only Tomcat):
```bash
docker-compose up --detach
```
`--detach` starts the containers in background (daemon mode).

### Start VISIONE in development/index mode:
```bash
docker-compose --profile devel up --detach
```

## Stop
```bash
docker-compose down
```

## Configuration

Configuration is done via **environment variables** passed to the `docker-compose` command.

The default configuration is contained in the `.env` file and is automatically loaded by `docker-compose`.
You can specify a different environment file using the `--env-file PATH` flag of `docker-compose`.

### Change ports/paths

Edit the `docker-compose.yml` file to change which ports are exposed and which folders of the host are mounted as volumes.

## Project structure / modules

- `.env`: file with declaration of environment variables containing secrets (username and passwords)
- `core/`: tomcat + servlets + web UI

