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
RUN sed -i -e 's:allow=":allow="\\d+\\.\\d+\\.\\d+\\.\\d+|:' $CATALINA_HOME/webapps/manager/META-INF/context.xml

# debug: enable tomcat listings
# RUN sed -i '/\s<param-name>listings<\/param-name>/{n;s/false/true/}' $CATALINA_HOME/conf/web.xml

# build tomcat webapp
COPY src/main/webapp ${CATALINA_HOME}/webapps/ROOT
COPY src/ /usr/local/src

RUN cd /usr/local/src && \
    find main/java -iname "*.java" > files.txt && \
    javac -target 1.8 -source 1.8 -cp "main/webapp/WEB-INF/lib/*" -d "$CATALINA_HOME/webapps/ROOT/WEB-INF/classes/" @files.txt && \
    rm files.txt