using GuildHub.ModelBaker.Maps;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Tests;

public class WorldMapLayoutTests
{
  static Dictionary<string, object?> Values(params (string Key, object? Value)[] pairs) =>
      pairs.ToDictionary(p => p.Key, p => p.Value);

  static InMemoryTables World() => new InMemoryTables()
      .Add("UiMap",
          Values(("ID", 10), ("Name_lang", "Continent"), ("Type", 2), ("System", 0), ("ParentUiMapID", 0)),
          Values(("ID", 11), ("Name_lang", "Zone"), ("Type", 3), ("System", 0), ("ParentUiMapID", 10)),
          Values(("ID", 12), ("Name_lang", "Taxi"), ("Type", 3), ("System", 1), ("ParentUiMapID", 10)))
      .Add("UiMapAssignment",
          Values(("UiMapID", 10), ("MapID", 1), ("AreaID", 0),
              ("UiMin", new[] { 0f, 0f }), ("UiMax", new[] { 1f, 1f }),
              ("Region", new[] { -1000f, -1000f, 0f, 1000f, 1000f, 0f })),
          Values(("UiMapID", 11), ("MapID", 1), ("AreaID", 17),
              ("UiMin", new[] { 0f, 0f }), ("UiMax", new[] { 1f, 1f }),
              ("Region", new[] { -500f, 0f, 0f, 500f, 1000f, 0f })))
      .Add("AreaTable",
          Values(("ID", 17), ("ParentAreaID", 0)),
          Values(("ID", 380), ("ParentAreaID", 17)))
      .Add("UiMapXMapArt",
          Values(("UiMapID", 10), ("UiMapArtID", 100), ("PhaseID", 0)),
          Values(("UiMapID", 11), ("UiMapArtID", 101), ("PhaseID", 0)))
      .Add("UiMapArt",
          Values(("ID", 100), ("UiMapArtStyleID", 1)),
          Values(("ID", 101), ("UiMapArtStyleID", 1)))
      .Add("UiMapArtStyleLayer",
          Values(("UiMapArtStyleID", 1), ("LayerIndex", 0), ("LayerWidth", 1002), ("LayerHeight", 668), ("TileWidth", 256), ("TileHeight", 256)))
      .Add("UiMapArtTile",
          Values(("UiMapArtID", 100), ("RowIndex", 0), ("ColIndex", 0), ("LayerIndex", 0), ("FileDataID", 5000)),
          Values(("UiMapArtID", 101), ("RowIndex", 0), ("ColIndex", 1), ("LayerIndex", 0), ("FileDataID", 5001)))
      .Add("WorldMapOverlay",
          Values(("ID", 7), ("UiMapArtID", 101), ("OffsetX", 120), ("OffsetY", 40)))
      .Add("WorldMapOverlayTile",
          Values(("WorldMapOverlayID", 7), ("RowIndex", 0), ("ColIndex", 0), ("LayerIndex", 0), ("FileDataID", 6000)));

  [Fact]
  public void PlacesZonesOnTheirContinentWithLeftAsTheLargestWorldY()
  {
    var layout = WorldMapLayouts.Read(World());

    var continent = Assert.Single(layout.Continents);
    Assert.Equal("Continent", continent.Name);
    var zone = Assert.Single(continent.Zones);
    Assert.Equal(11, zone.UiMapId);
    Assert.Equal(new MapRect(0, 0.25, 0.5, 0.75), zone.Rect);
  }

  [Fact]
  public void ZonesKnowTheirSubareasAndExploredOverlays()
  {
    var zone = WorldMapLayouts.Read(World()).Continents[0].Zones[0];

    Assert.Equal([17, 380], zone.AreaIds);
    var overlay = Assert.Single(zone.Art!.Overlays);
    Assert.Equal((120, 40), (overlay.OffsetX, overlay.OffsetY));
    Assert.Equal(6000, Assert.Single(overlay.Tiles).FileDataId);
  }
}
