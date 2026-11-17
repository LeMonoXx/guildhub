# Vendored WoWDBDefs definitions

These `.dbd` files and `manifest.json` were copied directly from
[wowdev/WoWDBDefs](https://github.com/wowdev/WoWDBDefs) commit
`12ce70d5fef13370f0edf08889f01c05321d2e28`. The world map definitions (`UiMap*.dbd`,
`WorldMapOverlay*.dbd`) come from commit `fe771f93091b18db417c99621cfe9e36a228a590`.

Only definitions needed by the table loaders and look/item resolvers in this project are included.
They are embedded into `GuildHub.ModelBaker.dll` so table parsing can start without downloading
definitions.

WoWDBDefs is licensed under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Changes to these definitions must preserve attribution and be distributed under the same license.
