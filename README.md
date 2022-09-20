# VISIONE

## Start
```bash
docker-compose up -d
```

`-d` starts the containers in background (daemon mode).

## Stop
```bash
docker-compose down
```

## Change ports/paths
Edit the `docker-compose.yml` file to change which ports are exposed and which folders of the host are mounted as volumes.

## Project structure / modules

- `.env`: file with declaration of environment variables containing secrets (username and passwords)
- `core/`: tomcat + servlets + web UI

