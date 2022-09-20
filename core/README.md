# VISIONE: core

Frontend code (tomcat + servlets + webUI). This is practically a tomcat container with the visione webapp added.

## Module structure

- `conf/`: home folder for servlet. This folder will be added in the container, and `VISIONE_HOME_3` env var will point to it.
- `root/`: root of the tomcat app. This folder will be added in the container as `$CATALINA_HOME/webapps/visione`.

## Container paths

Inside the container, the following folders are of interest:

- `/data/lucene_index`: the folder containing the prebuilt Lucene index. An external folder should be mounted in this path as a volume.
- `/conf`: the folder containing config files of the webapp (`VISIONE_HOME_3`); by default, `conf/` is added as `/conf` in the container.
- `/usr/local/tomcat/webapps/visione`: the folder containing the tomcat webapp; by default, `root/` is added as `/usr/local/tomcat/webapps/visione` in the container
