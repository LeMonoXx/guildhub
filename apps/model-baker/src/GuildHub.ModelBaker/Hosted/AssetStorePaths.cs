// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using GuildHub.ModelBaker.Convert;

namespace GuildHub.ModelBaker.Hosted;

/// <summary>
/// Where each baked file lives in the output directory. Relative paths use '/', as the web app
/// requests them; <see cref="FullPath"/> turns one into a file system path.
/// </summary>
public sealed class AssetStorePaths(string build)
{
  public const string CurrentPath = "current.json";

  string BuildRoot => $"builds/{build}/v{AssetConverter.OutputVersion}";

  public string ModelPath(int fileDataId) => $"{BuildRoot}/models/{fileDataId}.glb";

  public string MetadataPath(int fileDataId) => $"{BuildRoot}/models/{fileDataId}.json";

  public string TexturePath(int fileDataId) => $"{BuildRoot}/textures/{fileDataId}.png";

  public string AnimationPath(int modelFileDataId, int animationId) =>
      $"{BuildRoot}/anims/{modelFileDataId}/{animationId}.glb";

  public static string ManifestPath(string? lookHash) =>
      string.IsNullOrEmpty(lookHash) ? "looks/fixed/look.json" : $"looks/{lookHash}/look.json";

  public static string PrebakeMarkerFile(string root, string build, int race, int sex) =>
      Path.Combine(root, "builds", build, $"v{AssetConverter.OutputVersion}", "prebake", $"{race}-{sex}.json");

  public static string FullPath(string root, string relativePath) =>
      Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar));
}
