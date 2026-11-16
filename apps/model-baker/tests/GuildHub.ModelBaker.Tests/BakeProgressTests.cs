using GuildHub.ModelBaker.Hosted;

namespace GuildHub.ModelBaker.Tests;

public class BakeProgressTests
{
  [Fact]
  public void PhasesFillTheirOwnSliceAndNeverGoBack()
  {
    var reported = new List<double>();
    var progress = new BakeProgress(reported.Add);

    progress.Phase(BakeProgress.Body, 1, 1);
    progress.Phase(BakeProgress.Models, 1, 2);
    progress.Phase(BakeProgress.Models, 2, 2);
    progress.Phase(BakeProgress.Textures, 0, 400);
    progress.Phase(BakeProgress.Animations, 1, 1);

    Assert.Equal([0.15, 0.35, 0.55, 1], reported);
  }

  [Fact]
  public void SmallStepsAreReportedOncePerPercent()
  {
    var reported = new List<double>();
    var progress = new BakeProgress(reported.Add);

    for (var done = 0; done <= 1000; done++)
      progress.Phase(BakeProgress.Textures, done, 1000);

    Assert.InRange(reported.Count, 30, 40);
    Assert.Equal(0.9, reported[^1]);
  }

  [Fact]
  public void AnEmptyPhaseCountsAsDone()
  {
    var reported = new List<double>();
    new BakeProgress(reported.Add).Phase(BakeProgress.Models, 0, 0);

    Assert.Equal([0.55], reported);
  }
}
