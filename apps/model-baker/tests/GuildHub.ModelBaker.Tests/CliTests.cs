using GuildHub.ModelBaker.Cli;

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
    }

    [Fact]
    public void FixedLookOptionsHaveACompleteDefaultLook()
    {
        var success = FixedLookOptions.TryParse([], out var options, out var error);

        Assert.True(success, error);
        Assert.Equal("eu", options!.Region);
        Assert.Equal(1, options.Race);
        Assert.Equal(0, options.Sex);
        Assert.Equal([16820, 19019], options.ItemIds);
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

        Assert.False(FixedLookOptions.TryParse(
            ["--sex", "2"],
            out _,
            out var invalid));
        Assert.Contains("Invalid option or value", invalid);
    }
}
