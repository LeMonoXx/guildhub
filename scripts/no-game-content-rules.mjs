const vendoredDefinition =
  /^apps\/model-baker\/src\/[^/]+\/Definitions\/[^/]+\.dbd$/i;
const authoredViewerFixture =
  /^apps\/web\/test-fixtures\/assets\/builds\/authored-fixture\/v1\/(?:models\/1\.gltf|textures\/1\.png)$/i;
const gameExtension = /\.(?:gltf|glb|blp|m2|skin|anim|db2|wdc[^./]*)$/i;
const cascTactCache =
  /(?:^|\/)(?:casc|tact)(?:[-_]?(?:cache|indexes?|indices|archives?))(?:\/|$)/i;
const cascTactData =
  /(?:^|\/)(?:casc|tact)\/(?:data|indexes?|indices|archives?)(?:\/|$)/i;
const cascArchive =
  /(?:^|\/)(?:caches?|data|indexes?|indices|archives?)\/.*\.(?:idx|index|data|archive)$/i;
const cascInstallArchive =
  /(?:^|\/)data\/(?:data\/data\.\d+|indices\/[^/]+\.idx)$/i;
const generatedBakerImage =
  /^apps\/model-baker\/(?:.*\/)?(?:assets?|outputs?|caches?|bakes?|builds?)\/.*\.(?:png|jpe?g|gif|webp|bmp|tga|dds)$/i;
const generatedViewerImage =
  /^apps\/web\/test-fixtures\/assets\/builds\/.*\.(?:png|jpe?g|gif|webp|bmp|tga|dds)$/i;

export function violationReason(inputPath) {
  const path = inputPath.replaceAll("\\", "/");
  if (vendoredDefinition.test(path)) return null;
  if (authoredViewerFixture.test(path)) return null;
  if (gameExtension.test(path)) return "game-content extension";
  if (generatedViewerImage.test(path)) return "generated viewer image";
  if (
    cascTactCache.test(path) ||
    cascTactData.test(path) ||
    cascArchive.test(path) ||
    cascInstallArchive.test(path)
  ) {
    return "CASC/TACT cache or archive";
  }
  if (generatedBakerImage.test(path)) return "generated model-baker image";
  return null;
}

export function findViolations(paths) {
  return paths.flatMap((path) => {
    const reason = violationReason(path);
    return reason === null ? [] : [{ path, reason }];
  });
}
