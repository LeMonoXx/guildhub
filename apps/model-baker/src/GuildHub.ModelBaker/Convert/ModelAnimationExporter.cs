// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

// Portions ported from wow.export (https://github.com/Kruithne/wow.export), MIT License, Copyright (c) Kruithne and Marlamin.
// The animation layout follows src/js/3D/writers/GLTFWriter.js.

using System.Text.Json.Nodes;

namespace GuildHub.ModelBaker.Convert;

static class ModelAnimationExporter
{
  const int Float = 5126;

  public static int[] EmbeddedSequences(
      M2Sequence[] sequences,
      EmbeddedAnimationPolicy policy)
  {
    if (policy == EmbeddedAnimationPolicy.StandAndGlobals)
    {
      var stand = Array.FindIndex(
          sequences,
          sequence => sequence.Id == 0 && sequence.Variation == 0);
      return stand < 0 ? [] : [stand];
    }

    return sequences
        .Select((sequence, index) => (sequence, index))
        .Where(entry => !entry.sequence.IsAlias)
        .OrderBy(entry => entry.sequence.Id)
        .ThenBy(entry => entry.sequence.Variation)
        .Select(entry => entry.index)
        .ToArray();
  }

  public static (JsonArray clips, JsonArray metadata) ExportEmbedded(
      M2Model m2,
      IM2Skeleton skeleton,
      int[] embeddedSequences,
      EmbeddedAnimationPolicy animationPolicy,
      Func<uint, byte[]> open,
      GltfBinaryBuilder binary,
      int boneBase)
  {
    var animations = new JsonArray();
    var animMeta = new JsonArray();
    foreach (var seq in embeddedSequences)
    {
      var r = ExportAnimation(m2, skeleton, seq, open, binary, boneBase);
      if (r.anim != null) animations.Add(r.anim);
      animMeta.Add(r.meta);
    }
    if (animationPolicy == EmbeddedAnimationPolicy.StandAndGlobals &&
        !skeleton.Sequences.Any(sequence => sequence.Id == 0 && sequence.Variation == 0))
    {
      animMeta.Add(new JsonObject
      {
        ["id"] = 0,
        ["variation"] = 0,
        ["error"] = "no such sequence",
      });
    }
    // Global sequences loop on their own clock, whatever sequence is playing. Character models use
    // them for constant per-race tweaks, such as the scale and tilt of the shoulder attachment bones
    // (Orc male 1.7, Undead female 0.65), so each one becomes its own clip that plays alongside Stand.
    for (var gs = 0; gs < m2.GlobalSequences.Length; gs++)
    {
      var r = ExportAnimation(m2, skeleton, -1, open, binary, boneBase, gs);
      if (r.anim != null) animations.Add(r.anim);
      if (r.anim != null || r.meta["skippedSplineTracks"]!.GetValue<int>() > 0) animMeta.Add(r.meta);
    }
    return (animations, animMeta);
  }

  // The sequences an animation's file holds: every swing of an auto-attack, in variation order (aliases
  // left out), else the first variation (variation 0, or any one when the model has no variation 0).
  public static int[] SequencesFor(M2Sequence[] seqs, int animId)
  {
    if (AnimationNames.AutoAttacks.Contains(animId))
      return seqs.Select((q, i) => (q, i)).Where(x => x.q.Id == animId && !x.q.IsAlias).OrderBy(x => x.q.Variation).Select(x => x.i).ToArray();
    var seq = Array.FindIndex(seqs, q => q.Id == animId && q.Variation == 0);
    if (seq < 0) seq = Array.FindIndex(seqs, q => q.Id == animId);
    return seq < 0 ? [] : [seq];
  }

  // One animation (first variation of `animId`) for a model's bones, with no meshes: the viewer plays it
  // on the body it already loaded, whose bone nodes have the same names. Null when the model has no
  // such sequence or the sequence has no channels.
  public static byte[]? ConvertAnimation(
      M2Model m2,
      IM2Skeleton skeleton,
      int animId,
      Func<uint, byte[]> open,
      out JsonObject meta)
  {
    var seqs = SequencesFor(skeleton.Sequences, animId);
    if (seqs.Length == 0)
    {
      meta = new JsonObject { ["id"] = animId, ["error"] = "no such sequence" };
      return null;
    }
    var binary = new GltfBinaryBuilder();

    // One clip per sequence; the viewer plays them in turn (a single clip loops).
    var clips = new JsonArray();
    meta = null!;
    foreach (var seq in seqs)
    {
      var (anim, m) = ExportAnimation(m2, skeleton, seq, open, binary, 0);
      meta ??= m;
      if (anim != null) clips.Add(anim);
    }
    if (clips.Count == 0) return null;
    // Bone nodes carry only names and hierarchy: the clip's keys set every animated value.
    var nodes = new JsonArray();
    var roots = new JsonArray();
    for (var i = 0; i < skeleton.Bones.Length; i++) nodes.Add(new JsonObject { ["name"] = ModelConverter.BoneName(i) });
    for (var i = 0; i < skeleton.Bones.Length; i++)
    {
      var parent = skeleton.Bones[i].ParentBone;
      if (parent >= 0 && parent < skeleton.Bones.Length) ((nodes[parent]!["children"] ??= new JsonArray()) as JsonArray)!.Add(i);
      else roots.Add(i);
    }
    binary.Pad();
    var gltf = new JsonObject
    {
      ["asset"] = new JsonObject { ["version"] = "2.0", ["generator"] = "altrobe convert-animation" },
      ["scene"] = 0,
      ["scenes"] = new JsonArray(new JsonObject { ["nodes"] = roots }),
      ["nodes"] = nodes,
      ["animations"] = clips,
      ["accessors"] = binary.Accessors,
      ["bufferViews"] = binary.BufferViews,
      ["buffers"] = new JsonArray(new JsonObject { ["byteLength"] = binary.Length }),
    };
    return binary.Build(gltf);
  }

  // One glTF animation for sequence `seq`, or, when `globalSeq` >= 0, for the tracks tied to that global
  // sequence. A sequence clip skips global-sequence tracks (they go in their own clips). Spline
  // (bezier/hermite) tracks are skipped, as in wow.export's glTF writer; the counts go in the metadata.
  // Global-sequence tracks keep their keys at index 0 of the track and their data in the M2 itself
  // (https://wowdev.wiki/M2#Global_sequences).
  static (JsonObject? anim, JsonObject meta) ExportAnimation(
      M2Model m2,
      IM2Skeleton skeleton,
      int seq,
      Func<uint, byte[]> open,
      GltfBinaryBuilder binary,
      int boneBase,
      int globalSeq = -1)
  {
    var isGlobal = globalSeq >= 0;
    var duration = isGlobal ? m2.GlobalSequences[globalSeq] : skeleton.Sequences[seq].Duration;
    var keyIndex = isGlobal ? 0 : seq;
    JsonObject meta;
    byte[] data;
    int baseOfs;
    if (isGlobal)
    {
      meta = new JsonObject { ["globalSequence"] = globalSeq, ["durationMs"] = duration, ["source"] = "in-file" };
      (data, baseOfs) = skeleton.InFileData;
    }
    else
    {
      var q0 = skeleton.Sequences[seq];
      meta = new JsonObject { ["id"] = q0.Id, ["variation"] = q0.Variation, ["sequenceIndex"] = seq, ["durationMs"] = duration, ["flags"] = q0.Flags };
      var src = M2AnimSource.Resolve(skeleton, seq, open);
      if (src == null) { meta["error"] = "no track data (not in file, no AFID entry)"; return (null, meta); }
      (data, baseOfs, var source) = src.Value;
      meta["source"] = source;
    }

    var samplers = new JsonArray();
    var channels = new JsonArray();
    int globalSkipped = 0, splineSkipped = 0, emptyOrBad = 0;
    var counts = AnimationChannelExporters.BoneChannels.ToDictionary(exporter => exporter.Path, _ => 0);

    var sampleContext = new M2TrackSampleContext(
        keyIndex,
        duration,
        data,
        baseOfs,
        isGlobal ? globalSeq : null);

    void Channel(int bone, IAnimationChannelExporter exporter, M2Track track, float[] times, float[][] values)
    {
      var output = values.SelectMany(value => value).ToArray();
      var inAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(times)), Float, times.Length, "SCALAR", [times[0]], [times[^1]]);
      var outAcc = binary.AddAccessor(binary.AddView(GltfBinaryBuilder.Bytes(output)), Float, values.Length, values[0].Length == 4 ? "VEC4" : "VEC3");
      samplers.Add(new JsonObject
      {
        ["input"] = inAcc,
        ["output"] = outAcc,
        ["interpolation"] = track.Interpolation.GltfName(),
      });
      channels.Add(new JsonObject { ["sampler"] = samplers.Count - 1, ["target"] = new JsonObject { ["node"] = boneBase + bone, ["path"] = exporter.Path } });
      counts[exporter.Path]++;
    }

    for (var i = 0; i < skeleton.Bones.Length; i++)
    {
      var bone = skeleton.Bones[i];
      foreach (var exporter in AnimationChannelExporters.BoneChannels)
      {
        var track = exporter.Track(bone);
        switch (sampleContext.Classify(track))
        {
          case M2TrackUse.NotForClip:
            if (!isGlobal && track.GlobalSeq >= 0) globalSkipped++;
            continue;
          case M2TrackUse.Empty:
            continue;
          case M2TrackUse.Spline:
            splineSkipped++;
            continue;
          case M2TrackUse.Usable:
            break;
        }
        var keys = exporter.Read(bone, sampleContext, skeleton);
        if (keys == null) emptyOrBad++;
        else Channel(i, exporter, track, keys.Value.times, keys.Value.values);
      }
    }

    meta["channels"] = new JsonObject { ["translation"] = counts["translation"], ["rotation"] = counts["rotation"], ["scale"] = counts["scale"] };
    if (!isGlobal) meta["skippedGlobalSequenceTracks"] = globalSkipped;
    meta["skippedSplineTracks"] = splineSkipped;
    meta["unreadableTracks"] = emptyOrBad;
    if (channels.Count == 0) { meta["error"] = "no channels"; return (null, meta); }
    if (isGlobal)
    {
      var gname = $"Global_{globalSeq}";
      meta["name"] = gname;
      return (new JsonObject
      {
        ["name"] = gname,
        ["samplers"] = samplers,
        ["channels"] = channels,
        ["extras"] = new JsonObject { ["globalSequence"] = globalSeq, ["durationMs"] = duration }
      }, meta);
    }
    var q = skeleton.Sequences[seq];
    var name = q.Id == 0 ? $"Stand_{q.Variation}" : $"anim_{q.Id}_{q.Variation}";
    meta["name"] = name;
    return (new JsonObject
    {
      ["name"] = name,
      ["samplers"] = samplers,
      ["channels"] = channels,
      ["extras"] = new JsonObject { ["animId"] = q.Id, ["variation"] = q.Variation, ["durationMs"] = q.Duration }
    }, meta);
  }
}
