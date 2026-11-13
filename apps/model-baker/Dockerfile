# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY apps/model-baker/GuildHub.ModelBaker.slnx apps/model-baker/
COPY apps/model-baker/src/GuildHub.ModelBaker/GuildHub.ModelBaker.csproj apps/model-baker/src/GuildHub.ModelBaker/
COPY apps/model-baker/src/GuildHub.ModelBaker.Cli/GuildHub.ModelBaker.Cli.csproj apps/model-baker/src/GuildHub.ModelBaker.Cli/
RUN dotnet restore apps/model-baker/src/GuildHub.ModelBaker.Cli/GuildHub.ModelBaker.Cli.csproj
COPY apps/model-baker/src apps/model-baker/src
RUN dotnet publish apps/model-baker/src/GuildHub.ModelBaker.Cli/GuildHub.ModelBaker.Cli.csproj \
    --configuration Release \
    --no-restore \
    --output /out

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS runtime
WORKDIR /app
ENV DOTNET_EnableDiagnostics=0
RUN apt-get update \
    && apt-get install --yes --no-install-recommends iputils-ping \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=$APP_UID:$APP_UID /out ./
RUN mkdir -p /assets /cache && chown -R $APP_UID:$APP_UID /assets /cache
USER $APP_UID
VOLUME ["/assets", "/cache"]
ENTRYPOINT ["dotnet", "GuildHub.ModelBaker.Cli.dll"]
CMD ["bake-fixed", "--output", "/assets", "--cache", "/cache"]
