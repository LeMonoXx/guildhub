using GuildHub.ModelBaker.Convert;

namespace GuildHub.ModelBaker.Maps;

/// <summary>An RGBA canvas that clips every tile drawn onto it to its own bounds.</summary>
sealed class MapCanvas(int width, int height)
{
  public const int OverlayTileSize = 256;

  public byte[] Rgba { get; } = new byte[width * height * 4];

  public void Copy(Blp.Image image, int originX, int originY) =>
      Draw(image, originX, originY, (source, target) =>
          Buffer.BlockCopy(image.Rgba, source, Rgba, target, 4));

  public void Blend(Blp.Image image, int originX, int originY) =>
      Draw(image, originX, originY, (source, target) =>
      {
        var alpha = image.Rgba[source + 3];
        if (alpha == 0) return;
        for (var channel = 0; channel < 3; channel++)
        {
          var over = image.Rgba[source + channel];
          var under = Rgba[target + channel];
          Rgba[target + channel] = (byte)((over * alpha + under * (255 - alpha) + 127) / 255);
        }
        Rgba[target + 3] = Math.Max(Rgba[target + 3], alpha);
      });

  void Draw(Blp.Image image, int originX, int originY, Action<int, int> pixel)
  {
    for (var y = Math.Max(0, -originY); y < image.Height && originY + y < height; y++)
      for (var x = Math.Max(0, -originX); x < image.Width && originX + x < width; x++)
        pixel((y * image.Width + x) * 4, ((originY + y) * width + originX + x) * 4);
  }
}
