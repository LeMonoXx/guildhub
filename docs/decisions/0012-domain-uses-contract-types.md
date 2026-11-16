# 0012. The domain may use contract shapes as types

- Status: Accepted
- Date: 2026-11-16

## Context

`backend.md` allowed the domain to import only its own domain and `platform/kernel`. In practice the
profile, history, chronicle and crafting domains describe the same shapes the API publishes:
a character profile, a history event, a recipe. Restating those shapes as separate domain types
would mean several hundred lines of interfaces kept in step with `packages/contracts` by hand.

The boundary check did not catch the difference, because the domain rule exempted every type-only
import. That exemption also let the chronicle domain read types from the character and guild
modules, which the module rules forbid outright.

## Decision

- Domain code may `import type` from `packages/contracts`. A value import (a zod schema, a constant)
  from contracts stays forbidden, so validation and schema code never enter the core.
- No other type-only exemption: a domain imports only its own domain, `platform/kernel`, and contract
  types; an application imports only what its row in `backend.md` lists. dependency-cruiser enforces
  both without exceptions.
- A domain that needs facts owned by another module defines its own narrow type for them. The
  application maps the other module's public data onto it.

## Consequences

- One source of truth for published shapes; a contract change shows up as a type error in the
  domain that uses it.
- The domain is coupled to the published shape. When a domain needs a model that differs from what
  the API returns, it gets its own type instead of bending the contract.
- The tightened rules surfaced the chronicle domain's cross-module imports; it now has
  `ChronicleMember` and `ChronicleProfile`.
