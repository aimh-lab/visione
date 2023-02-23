FROM docker.io/maven:3.8.6-openjdk-18

WORKDIR /usr/src/app

COPY . .
RUN mvn clean compile assembly:single && \
    mv target/lucene-index-manager-0.5.jar . && \
    rm -rf target ~/.m2

ENTRYPOINT [ "java", "-jar", "lucene-index-manager-0.5.jar" ]