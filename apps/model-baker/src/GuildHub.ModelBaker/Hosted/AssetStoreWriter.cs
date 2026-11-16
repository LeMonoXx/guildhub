// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

using System.Text.Json;
using GuildHub.ModelBaker.Cache;

namespace GuildHub.ModelBaker.Hosted;

public sealed class AssetStoreWriter(string root)
{
  static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
  {
    WriteIndented = true,
  };

  public bool Exists(string relativePath) =>
      File.Exists(AssetStorePaths.FullPath(root, relativePath));

  public byte[] Read(string relativePath) =>
      File.ReadAllBytes(AssetStorePaths.FullPath(root, relativePath));

  public void Write(string relativePath, ReadOnlySpan<byte> bytes) =>
      AtomicFile.WriteAllBytes(AssetStorePaths.FullPath(root, relativePath), bytes);

  public void WriteJson<T>(string relativePath, T value) =>
      AtomicFile.WriteAllText(
          AssetStorePaths.FullPath(root, relativePath),
          JsonSerializer.Serialize(value, Json));
}
