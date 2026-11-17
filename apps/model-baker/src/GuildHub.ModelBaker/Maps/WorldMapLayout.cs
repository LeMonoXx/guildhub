using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Maps;

public sealed record MapRect(double Left, double Top, double Right, double Bottom);

public sealed record MapTile(int Row, int Column, int FileDataId);

/// <summary>An explored-area painting laid over the base map at a pixel offset.</summary>
public sealed record MapOverlay(int OffsetX, int OffsetY, IReadOnlyList<MapTile> Tiles);

public sealed record MapArt(
    int Width,
    int Height,
    int TileWidth,
    int TileHeight,
    IReadOnlyList<MapTile> Tiles,
    IReadOnlyList<MapOverlay> Overlays);

public sealed record ZoneLayout(
    int UiMapId,
    string Name,
    IReadOnlyList<int> AreaIds,
    MapRect Rect,
    MapArt? Art);

public sealed record ContinentLayout(
    int UiMapId,
    string Name,
    MapArt Art,
    IReadOnlyList<ZoneLayout> Zones);

public sealed record WorldMapLayout(IReadOnlyList<ContinentLayout> Continents);

/// <summary>
/// Reads the client's UiMap tables: which continents and zones exist, which painted tiles make
/// each map, and where each zone sits on its continent. World coordinates run north along X and
/// west along Y, so a map's left edge is its largest Y and its top edge its largest X.
/// </summary>
public static class WorldMapLayouts
{
  const int ContinentType = 2;
  const int ZoneType = 3;
  const int WorldSystem = 0;

  sealed record Assignment(int UiMapId, int MapId, int AreaId, double[] UiMin, double[] UiMax, double[] Region)
  {
    public double UiArea => (UiMax[0] - UiMin[0]) * (UiMax[1] - UiMin[1]);

    public bool Usable => UiMin.Length == 2 && UiMax.Length == 2 && Region.Length == 6
        && UiMax[0] > UiMin[0] && UiMax[1] > UiMin[1]
        && Region[3] > Region[0] && Region[4] > Region[1];

    public (double X, double Y) World(double u, double v) => (
        Region[3] - (v - UiMin[1]) / (UiMax[1] - UiMin[1]) * (Region[3] - Region[0]),
        Region[4] - (u - UiMin[0]) / (UiMax[0] - UiMin[0]) * (Region[4] - Region[1]));

    public (double U, double V) Ui(double x, double y) => (
        UiMin[0] + (Region[4] - y) / (Region[4] - Region[1]) * (UiMax[0] - UiMin[0]),
        UiMin[1] + (Region[3] - x) / (Region[3] - Region[0]) * (UiMax[1] - UiMin[1]));
  }

  public static WorldMapLayout Read(ITables tables)
  {
    var maps = tables.Get("UiMap").Where(r => r.Int("System") == WorldSystem).ToList();
    var assignments = tables.Get("UiMapAssignment")
        .Select(r => new Assignment(
            r.Int("UiMapID"),
            r.Int("MapID"),
            r.Int("AreaID"),
            r.Floats("UiMin"),
            r.Floats("UiMax"),
            r.Floats("Region")))
        .ToLookup(a => a.UiMapId);
    var arts = ReadArt(tables);

    Assignment? Frame(int uiMapId, int? mapId = null) => assignments[uiMapId]
        .Where(a => a.Usable && (mapId == null || a.MapId == mapId))
        .OrderByDescending(a => a.UiArea)
        .FirstOrDefault();

    var subareas = tables.Has("AreaTable")
        ? tables.Get("AreaTable").ToLookup(r => r.Int("ParentAreaID"), r => r.Int("ID"))
        : Array.Empty<int>().ToLookup(_ => 0);

    int[] AreaIds(int uiMapId) => WithSubareas(
            assignments[uiMapId].Select(a => a.AreaId).Where(id => id > 0),
            subareas)
        .Order()
        .ToArray();

    var continents = maps
        .Where(m => m.Int("Type") == ContinentType && arts.ContainsKey(m.Int("ID")))
        .Select(continent =>
        {
          var id = continent.Int("ID");
          var frame = Frame(id);
          var zones = frame == null ? [] : maps
              .Where(m => m.Int("Type") == ZoneType && m.Int("ParentUiMapID") == id)
              .Select(zone => PlaceZone(zone, Frame(zone.Int("ID"), frame.MapId), frame, AreaIds(zone.Int("ID")), arts))
              .OfType<ZoneLayout>()
              .OrderBy(z => z.UiMapId)
              .ToList();
          return new ContinentLayout(id, continent.Str("Name_lang"), arts[id], zones);
        })
        .Where(c => c.Zones.Count > 0)
        .OrderBy(c => c.UiMapId)
        .ToList();

    return new WorldMapLayout(continents);
  }

  static HashSet<int> WithSubareas(IEnumerable<int> roots, ILookup<int, int> subareas)
  {
    var found = new HashSet<int>();
    var pending = new Stack<int>(roots);
    while (pending.TryPop(out var area))
    {
      if (!found.Add(area)) continue;
      foreach (var child in subareas[area]) pending.Push(child);
    }
    return found;
  }

  static ZoneLayout? PlaceZone(
      Row zone,
      Assignment? own,
      Assignment continent,
      int[] areaIds,
      IReadOnlyDictionary<int, MapArt> arts)
  {
    if (own == null) return null;
    var (topX, leftY) = own.World(0, 0);
    var (bottomX, rightY) = own.World(1, 1);
    var (left, top) = continent.Ui(topX, leftY);
    var (right, bottom) = continent.Ui(bottomX, rightY);
    if (right <= left || bottom <= top) return null;
    var id = zone.Int("ID");
    return new ZoneLayout(
        id,
        zone.Str("Name_lang"),
        areaIds,
        new MapRect(Round(left), Round(top), Round(right), Round(bottom)),
        arts.GetValueOrDefault(id));
  }

  static Dictionary<int, MapArt> ReadArt(ITables tables)
  {
    var styleLayers = tables.Get("UiMapArtStyleLayer")
        .Where(r => r.Int("LayerIndex") == 0)
        .GroupBy(r => r.Int("UiMapArtStyleID"))
        .ToDictionary(g => g.Key, g => g.First());
    var styles = tables.Get("UiMapArt").ToDictionary(r => r.Int("ID"), r => r.Int("UiMapArtStyleID"));
    var tiles = tables.Get("UiMapArtTile")
        .Where(r => r.Int("LayerIndex") == 0)
        .ToLookup(r => r.Int("UiMapArtID"));
    var overlays = ReadOverlays(tables);
    var art = new Dictionary<int, MapArt>();
    foreach (var link in tables.Get("UiMapXMapArt").Where(r => r.Int("PhaseID") == 0))
    {
      var uiMapId = link.Int("UiMapID");
      var artId = link.Int("UiMapArtID");
      if (art.ContainsKey(uiMapId)
          || !styles.TryGetValue(artId, out var styleId)
          || !styleLayers.TryGetValue(styleId, out var layer)) continue;
      var parts = Tiles(tiles[artId]);
      if (parts.Count == 0) continue;
      art[uiMapId] = new MapArt(
          layer.Int("LayerWidth"),
          layer.Int("LayerHeight"),
          layer.Int("TileWidth"),
          layer.Int("TileHeight"),
          parts,
          overlays[artId].ToList());
    }
    return art;
  }

  static ILookup<int, MapOverlay> ReadOverlays(ITables tables)
  {
    if (!tables.Has("WorldMapOverlay") || !tables.Has("WorldMapOverlayTile"))
      return Array.Empty<MapOverlay>().ToLookup(_ => 0);
    var tiles = tables.Get("WorldMapOverlayTile")
        .Where(r => r.Int("LayerIndex") == 0)
        .ToLookup(r => r.Int("WorldMapOverlayID"));
    return tables.Get("WorldMapOverlay")
        .Select(r => (ArtId: r.Int("UiMapArtID"), Overlay: new MapOverlay(r.Int("OffsetX"), r.Int("OffsetY"), Tiles(tiles[r.Int("ID")]))))
        .Where(o => o.ArtId > 0 && o.Overlay.Tiles.Count > 0)
        .ToLookup(o => o.ArtId, o => o.Overlay);
  }

  static List<MapTile> Tiles(IEnumerable<Row> rows) => rows
      .Select(t => new MapTile(t.Int("RowIndex"), t.Int("ColIndex"), t.Int("FileDataID")))
      .Where(t => t.FileDataId > 0)
      .OrderBy(t => t.Row).ThenBy(t => t.Column)
      .ToList();

  static double Round(double value) => Math.Round(value, 5);
}
