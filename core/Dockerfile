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

# COPY are good for deploy, but these should be mounted for develop
COPY conf/ /conf
# COPY setenv.sh $CATALINA_HOME/bin
COPY root/ $CATALINA_HOME/webapps/ROOT
# COPY Visione.war $CATALINA_HOME/webapps

ENV VISIONE_HOME_3 /conf