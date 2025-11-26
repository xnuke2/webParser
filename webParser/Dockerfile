FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["webParser.csproj", "."]
RUN dotnet restore "webParser.csproj"
COPY . .
RUN dotnet publish "webParser.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "webParser.dll"]