namespace GuildHub.ModelBaker.Hosted;

public sealed record PrebakeResult(int Race, int Sex, int Textures, bool Baked);

/// <summary>
/// Turns the steps of a bake into one share from 0 to 1. Each phase owns a fixed slice,
/// so the share never goes back when a later phase finds more work than expected.
/// </summary>
public sealed class BakeProgress(Action<double>? report)
{
  public readonly record struct Slice(double Start, double End);

  public static readonly Slice Body = new(0, 0.15);
  public static readonly Slice Models = new(0.15, 0.55);
  public static readonly Slice Textures = new(0.55, 0.9);
  public static readonly Slice Animations = new(0.9, 1);

  double _reported = -1;

  public void Phase(Slice slice, int done, int total)
  {
    if (report == null) return;
    var share = total <= 0 ? 1 : Math.Clamp((double)done / total, 0, 1);
    var fraction = slice.Start + (slice.End - slice.Start) * share;
    if (fraction <= _reported) return;
    // Hundreds of textures would flood the channel; whole percents are enough to watch.
    if (done < total && fraction - _reported < 0.01) return;
    _reported = fraction;
    report(Math.Round(fraction, 3));
  }
}
