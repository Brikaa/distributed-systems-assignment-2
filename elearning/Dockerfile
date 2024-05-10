FROM eclipse-temurin:22

WORKDIR /opt/wildfly
RUN apt-get update && \
    apt-get install -y unzip maven && \
    wget https://github.com/wildfly/wildfly/releases/download/32.0.0.Final/wildfly-32.0.0.Final.zip && \
    unzip wildfly-32.0.0.Final.zip && \
    mv wildfly-32.0.0.Final/* . && \
    rm -r wildfly-32.0.0.Final*

WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.m2 \
    mvn clean package && cp target/elearning.war /opt/wildfly/standalone/deployments

CMD ["/opt/wildfly/bin/standalone.sh", "-c", "standalone-full.xml", "-b", "0.0.0.0"]
