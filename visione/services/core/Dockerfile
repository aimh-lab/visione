FROM docker.io/maven:3.8.6-openjdk-18 as build

WORKDIR /usr/src/app

COPY . .

RUN --mount=type=cache,target=/root/.m2 \
    mvn install:install-file \
      -Dfile=src/main/webapp/WEB-INF/lib/openapi-java-client-2.0.0.jar \
      -DgroupId=org.openapitools.client -DartifactId=model -Dversion=2.0.0 -Dpackaging=jar

RUN --mount=type=cache,target=/root/.m2 mvn clean compile package

FROM tomcat:9

## CONFIGURE TOMCAT
ARG TOMCAT_MANAGER_USER
ARG TOMCAT_MANAGER_PASS

# enable manager
RUN mv ${CATALINA_HOME}/webapps.dist/manager ${CATALINA_HOME}/webapps/

# change admin password
RUN tac ${CATALINA_HOME}/conf/tomcat-users.xml | \
    sed "2i<user username=\"${TOMCAT_MANAGER_USER}\" password=\"${TOMCAT_MANAGER_PASS}\" roles=\"manager-gui\"/>" | \
    tac > /tmp/tomcat-users.xml && \
    mv /tmp/tomcat-users.xml $CATALINA_HOME/conf/tomcat-users.xml

# enable connections from the host of container
# (the host appear as 172.x.x.x for containerized tomcat)
RUN sed -i -e 's:allow=":allow="172\\.\\d+\\.\\d+\\.\\d+|:' $CATALINA_HOME/webapps/manager/META-INF/context.xml

# debug: enable tomcat listings
# RUN sed -i '/\s<param-name>listings<\/param-name>/{n;s/false/true/}' $CATALINA_HOME/conf/web.xml

# copy tomcat webapp
COPY --from=build /usr/src/app/target/core-0.5.war ${CATALINA_HOME}/webapps/ROOT.war
# RUN ls -l ${CATALINA_HOME}/webapps/ROOT