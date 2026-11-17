using GuildHub.ModelBaker.Convert;
using GuildHub.ModelBaker.Hosted;
using GuildHub.ModelBaker.Storage;
using GuildHub.ModelBaker.Tables;

namespace GuildHub.ModelBaker.Maps;

public sealed record WorldMapImage(string Path, int Width, int Height);

public sealed record WorldMapZone(
    int UiMapId,
    string Name,
    IReadOnlyList<int> AreaIds,
    MapRect Rect,
    WorldMapImage? Image);

public sealed record WorldMapContinent(
    int UiMapId,
    string Name,
    WorldMapImage Image,
    IReadOnlyList<WorldMapZone> Zones);

public sealed record WorldMapAtlas(
    int Version,
    string Build,
    IReadOnlyList<WorldMapContinent> Continents);

/// <summary>
/// Stitches each continent's and zone's painted map tiles into one PNG and writes the atlas the
/// web app places zones and markers with.
/// </summary>
public sealed class WorldMapBaker(IGameFiles files, ITables tables, string build)
{
  public const int OutputVersion = 1;
  public static readonly string Root = $"maps/v{OutputVersion}";
  public static readonly string AtlasPath = $"{Root}/atlas.json";

  public WorldMapAtlas Bake(string outputDirectory, Action<string>? log = null, Action<double>? progress = null)
  {
    var store = new AssetStoreWriter(outputDirectory);
    var layout = WorldMapLayouts.Read(tables);
    var total = layout.Continents.Sum(c => 1 + c.Zones.Count(z => z.Art != null));
    var done = 0;
    WorldMapImage? Write(int uiMapId, MapArt? art)
    {
      if (art == null) return null;
      var image = WriteImage(store, uiMapId, art);
      progress?.Invoke(++done / (double)Math.Max(total, 1));
      return image;
    }
    var continents = layout.Continents.Select(continent =>
    {
      log?.Invoke($"Map {continent.Name}: {continent.Zones.Count} zones");
      return new WorldMapContinent(
          continent.UiMapId,
          continent.Name,
          Write(continent.UiMapId, continent.Art)!,
          continent.Zones
              .Select(zone => new WorldMapZone(zone.UiMapId, zone.Name, zone.AreaIds, zone.Rect, Write(zone.UiMapId, zone.Art)))
              .ToList());
    }).ToList();
    var atlas = new WorldMapAtlas(OutputVersion, build, continents);
    store.WriteJson(AtlasPath, atlas);
    return atlas;
  }

  WorldMapImage WriteImage(AssetStoreWriter store, int uiMapId, MapArt art)
  {
    var path = $"{Root}/{uiMapId}.png";
    if (!store.Exists(path))
      store.Write(path, Png.Encode(art.Width, art.Height, Stitch(art)));
    return new WorldMapImage(path, art.Width, art.Height);
  }

  byte[] Stitch(MapArt art)
  {
    var canvas = new MapCanvas(art.Width, art.Height);
    foreach (var tile in art.Tiles)
      if (Decode(tile) is { } image)
        canvas.Copy(image, tile.Column * art.TileWidth, tile.Row * art.TileHeight);
    foreach (var overlay in art.Overlays)
      foreach (var tile in overlay.Tiles)
        if (Decode(tile) is { } image)
          canvas.Blend(
              image,
              overlay.OffsetX + tile.Column * MapCanvas.OverlayTileSize,
              overlay.OffsetY + tile.Row * MapCanvas.OverlayTileSize);
    return canvas.Rgba;
  }

  Blp.Image? Decode(MapTile tile) =>
      files.Exists((uint)tile.FileDataId) ? Blp.Decode(files.Open((uint)tile.FileDataId)) : null;
}
