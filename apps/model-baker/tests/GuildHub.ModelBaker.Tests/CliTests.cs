using GuildHub.ModelBaker.Cli;
using GuildHub.ModelBaker.Cli.Options;
using GuildHub.ModelBaker.Cli.ProofScenes;
using GuildHub.ModelBaker.Resolve;

namespace GuildHub.ModelBaker.Tests;

public class CliTests
{
  [Theory]
  [InlineData()]
  [InlineData("--help")]
  [InlineData("-h")]
  public async Task HelpAndNoArgumentsAreOfflineUsagePaths(params string[] args)
  {
    var output = new StringWriter();
    var error = new StringWriter();

    var exitCode = await CliApplication.RunAsync(args, output, error);

    Assert.Equal(0, exitCode);
    Assert.Contains("bake-fixed", output.ToString());
    Assert.Contains("bake-look", output.ToString());
    Assert.Contains("bake-looks", output.ToString());
    Assert.Contains("bake-file", output.ToString());
    Assert.Contains("bake-proof-scene rogue-t2", output.ToString());
    Assert.Contains("--class <id>", output.ToString());
    Assert.Contains("must never be committed", output.ToString());
    Assert.Empty(error.ToString());
  }

  [Fact]
  public async Task UnknownArgumentsFailWithoutStartingABake()
  {
    var output = new StringWriter();
    var error = new StringWriter();

    var exitCode = await CliApplication.RunAsync(["bake"], output, error);

    Assert.Equal(2, exitCode);
    Assert.Empty(output.ToString());
    Assert.Contains("Unknown argument: bake", error.ToString());

    output.GetStringBuilder().Clear();
    error.GetStringBuilder().Clear();
    exitCode = await CliApplication.RunAsync(["bake-proof-scene", "unknown"], output, error);
    Assert.Equal(2, exitCode);
    Assert.Empty(output.ToString());
    Assert.Contains("Unknown proof scene: unknown", error.ToString());
  }

  [Fact]
  public void FixedLookOptionsHaveACompleteDefaultLook()
  {
    var success = FixedLookOptions.TryParse([], out var options, out var error);

    Assert.True(success, error);
    Assert.Equal("eu", options!.Region);
    Assert.Equal(1, options.Race);
    Assert.Equal(0, options.Sex);
    Assert.Equal(1, options.ClassId);
    Assert.Equal([16820, 19019], options.ItemIds);
    Assert.Equal([0, 67], options.AnimationIds);
    Assert.Empty(options.EquipmentOverrides!);
  }

  [Fact]
  public void FixedLookOptionsAcceptRepeatableItemsAndRejectInvalidSex()
  {
    Assert.True(FixedLookOptions.TryParse(
        ["--race", "2", "--sex", "1", "--item", "1", "--item", "2"],
        out var options,
        out var error), error);
    Assert.Equal([1, 2], options!.ItemIds);
    Assert.Equal((2, 1), (options.Race, options.Sex));

    Assert.True(FixedLookOptions.TryParse(
        ["--animation", "0", "--animation", "224"],
        out var animations,
        out error), error);
    Assert.Equal([0, 224], animations!.AnimationIds);

    Assert.False(FixedLookOptions.TryParse(
        ["--sex", "2"],
        out _,
        out var invalid));
    Assert.Contains("Invalid option or value", invalid);
  }

  [Fact]
  public void FixedLookOptionsAcceptClassAndExplicitDualHandPlacement()
  {
    Assert.True(FixedLookOptions.TryParse(
        ["--class", "4", "--main-hand", "18816", "--off-hand", "18805"],
        out var options,
        out var error), error);

    Assert.Equal(4, options!.ClassId);
    Assert.Equal([18816, 18805], options.ItemIds);
    Assert.Equal(
        [new EquipmentSlotOverride(18816, ItemResolver.MainHandSlot), new EquipmentSlotOverride(18805, ItemResolver.OffHandSlot)],
        options.EquipmentOverrides);

    Assert.False(FixedLookOptions.TryParse(["--class", "0"], out _, out var invalidClass));
    Assert.Contains("Invalid option or value", invalidClass);
    Assert.False(FixedLookOptions.TryParse(
        ["--main-hand", "1", "--main-hand", "2"],
        out _,
        out var duplicateSlot));
    Assert.Contains("duplicate equipment slot", duplicateSlot, StringComparison.OrdinalIgnoreCase);
  }

  [Fact]
  public void RogueTier2ProofSceneIsNamedInspectableAndPathOverridable()
  {
    var scene = ProofSceneCatalog.RogueTier2;

    Assert.Equal("rogue-t2", scene.Name);
    Assert.Equal((1, 0, 4), (scene.Options.Race, scene.Options.Sex, scene.Options.ClassId));
    Assert.Equal(
        [16908, 16832, 16905, 16911, 16907, 16910, 16909, 16906, 18816, 18805],
        scene.Options.ItemIds);
    Assert.Equal([0, 4, 5, 26, 32, 54, 114, 115, 116, 119, 120, 123, 128, 129, 224], scene.Options.AnimationIds);
    Assert.Equal(
        [new EquipmentSlotOverride(18816, ItemResolver.MainHandSlot), new EquipmentSlotOverride(18805, ItemResolver.OffHandSlot)],
        scene.Options.EquipmentOverrides);

    Assert.True(FixedLookOptions.TryParse(
        ["--output", "proof-output", "--cache", "proof-cache", "--region", "us"],
        scene.Options,
        out var overridden,
        out var error), error);
    Assert.Equal("us", overridden!.Region);
    Assert.EndsWith("proof-output", overridden.OutputDirectory);
    Assert.EndsWith("proof-cache", overridden.CacheDirectory);
    Assert.Equal(scene.Options.ItemIds, overridden.ItemIds);
  }

  [Fact]
  public void LookAndFileCommandsParseOffline()
  {
    Assert.True(LookCommandOptions.TryParse(
        ["--look", "look.request.json", "--output", "out", "--cache", "cache"],
        out var look,
        out var error), error);
    Assert.EndsWith("look.request.json", look!.LookFile);
    Assert.True(FileCommandOptions.TryParse(
        ["--kind", "model", "--file-id", "123"],
        out var file,
        out error), error);
    Assert.Equal(("model", 123), (file!.Kind, file.FileId));
    Assert.False(FileCommandOptions.TryParse(["--kind", "model"], out _, out var missing));
    Assert.Contains("file-id", missing, StringComparison.OrdinalIgnoreCase);
  }
}
