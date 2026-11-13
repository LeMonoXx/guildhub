using GuildHub.ModelBaker.Cli;

namespace GuildHub.ModelBaker.Tests;

public class CliTests
{
    [Theory]
    [InlineData()]
    [InlineData("--help")]
    [InlineData("-h")]
    public void HelpAndNoArgumentsAreOfflineUsagePaths(params string[] args)
    {
        var output = new StringWriter();
        var error = new StringWriter();

        var exitCode = CliApplication.Run(args, output, error);

        Assert.Equal(0, exitCode);
        Assert.Contains("Fixed-look baking arrives in Phase 2", output.ToString());
        Assert.Contains("does not access the network", output.ToString());
        Assert.Empty(error.ToString());
    }

    [Fact]
    public void UnknownArgumentsFailWithoutStartingABake()
    {
        var output = new StringWriter();
        var error = new StringWriter();

        var exitCode = CliApplication.Run(["bake"], output, error);

        Assert.Equal(2, exitCode);
        Assert.Empty(output.ToString());
        Assert.Contains("Unknown argument: bake", error.ToString());
        Assert.Contains("Phase 2", error.ToString());
    }
}
