// Adapted from Altrobe commit b864982c08d5ac735369bdd73cb9c7bb5ca4dfa7.
// Copyright (c) 2026 Ryan Williams. Licensed under the MIT License.
// See apps/model-baker/THIRD-PARTY-NOTICES.md.

namespace GuildHub.ModelBaker;

// A lazily computed value that caches success only. Lazy<T> also caches the exception from a failed
// first run, so one transient failure (for example a definition download while offline) would keep
// failing for the rest of the session.
public sealed class Memo<T>(Func<T> factory)
{
    readonly Lock _lock = new();
    bool _done;
    T _value = default!;

    public T Value
    {
        get
        {
            lock (_lock)
            {
                if (!_done)
                {
                    _value = factory();
                    _done = true;
                }
                return _value;
            }
        }
    }
}
