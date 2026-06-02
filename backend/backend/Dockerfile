FROM maven:3.9-eclipse-temurin-21 AS build

WORKDIR /workspace

COPY backend/backend/pom.xml backend/backend/pom.xml
WORKDIR /workspace/backend/backend
RUN mvn -B dependency:go-offline

WORKDIR /workspace
COPY backend/backend backend/backend
COPY database/migrations database/migrations

WORKDIR /workspace/backend/backend
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy

ENV JAVA_TOOL_OPTIONS="-Dfile.encoding=UTF-8"

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/backend/backend/target/*.jar /app/app.jar
COPY --from=build /workspace/database/migrations /app/database/migrations

EXPOSE 8031

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
