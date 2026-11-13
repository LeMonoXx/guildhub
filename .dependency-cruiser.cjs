/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment:
        "This dependency is part of a circular relationship. Invert the dependency or split the cycle.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "This module is unused. Use it or remove it. Config, declaration, and test files are already excluded.",
      severity: "error",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)[.][^/]+[.](?:js|cjs|mjs|ts|cts|mts|json)$",
          "[.]d[.]ts$",
          "(^|/)tsconfig[.]json$",
          "(^|/)(?:babel|webpack)[.]config[.](?:js|cjs|mjs|ts|cts|mts|json)$",
          "(^|/)(?:eslint|prettier|vitest)[.]config[.](?:js|cjs|mjs|ts)$",
          "^scripts/",
          "^apphost/",
          "^apps/[^/]+/(?:drizzle[.]config[.]ts|instrumentation-loader[.]mjs)$",
        ],
      },
      to: {},
    },
    {
      name: "not-to-unresolvable",
      comment:
        "This import cannot be resolved to a file or an installed package.",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "not-to-deprecated",
      comment:
        "This module uses a deprecated npm package. Upgrade it or replace it.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["deprecated"] },
    },
    {
      name: "no-deprecated-core",
      comment: "This module uses a deprecated Node.js core module.",
      severity: "error",
      from: {},
      to: {
        dependencyTypes: ["core"],
        path: [
          "^punycode$",
          "^domain$",
          "^constants$",
          "^sys$",
          "^_linklist$",
          "^_stream_wrap$",
        ],
      },
    },
    {
      name: "not-to-spec",
      comment: "Production code must not import a test file.",
      severity: "error",
      from: { pathNot: "[.](?:int[.])?test[.](?:js|mjs|cjs|ts)$" },
      to: { path: "[.](?:int[.])?test[.](?:js|mjs|cjs|ts)$" },
    },
    {
      name: "not-to-dev-dep",
      comment:
        "Shipped code must not import a package that is only listed as a devDependency.",
      severity: "error",
      from: {
        path: "^(apps|packages)/",
        pathNot: [
          "[.](?:int[.])?test[.](?:js|mjs|cjs|ts)$",
          "^apps/[^/]+/(?:drizzle[.]config[.]ts|vitest[.]config[.]ts)$",
        ],
      },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: "node_modules/@types/",
      },
    },
    {
      name: "no-app-to-app",
      comment:
        "Deployable apps do not import each other. Share code through packages or HTTP.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: {
        path: "^apps/",
        pathNot: "^apps/$1/",
      },
    },
    {
      name: "contracts-only-zod",
      comment: "packages/contracts may depend on zod and Node builtins only.",
      severity: "error",
      from: { path: "^packages/contracts/" },
      to: {
        pathNot: "^packages/contracts/",
        dependencyTypesNot: ["npm", "core", "type-only"],
      },
    },
    {
      name: "no-platform-to-modules",
      comment: "platform code never imports a feature module.",
      severity: "error",
      from: { path: "^apps/api/src/platform/" },
      to: { path: "^apps/api/src/modules/" },
    },
    {
      name: "no-api-to-instances",
      comment:
        "Instance data is loaded as files through platform/config, never imported as a module.",
      severity: "error",
      from: { path: "^apps/" },
      to: { path: "^instances/" },
    },
    {
      name: "guild-domain-isolation",
      comment:
        "Domain code may import only its own domain and platform/kernel.",
      severity: "error",
      from: {
        path: "^apps/api/src/modules/([^/]+)/domain/",
        pathNot: "[.](?:int[.])?test[.]ts$",
      },
      to: {
        pathNot: [
          "^apps/api/src/modules/$1/domain/",
          "^apps/api/src/platform/kernel/",
        ],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "guild-application-isolation",
      comment:
        "Application code may import only its own domain and application, platform/kernel, and other modules' public index.",
      severity: "error",
      from: {
        path: "^apps/api/src/modules/([^/]+)/application/",
        pathNot: "[.](?:int[.])?test[.]ts$",
      },
      to: {
        pathNot: [
          "^apps/api/src/modules/$1/(?:domain|application)/",
          "^apps/api/src/modules/[^/]+/index[.]ts$",
          "^apps/api/src/platform/kernel/",
        ],
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "guild-http-isolation",
      comment:
        "HTTP handlers may import own application, type-only own domain, contracts, platform/http, and platform/kernel.",
      severity: "error",
      from: {
        path: "^apps/api/src/modules/([^/]+)/http/",
        pathNot: "[.](?:int[.])?test[.]ts$",
      },
      to: {
        pathNot: [
          "^apps/api/src/modules/$1/application/",
          "^apps/api/src/modules/$1/http/",
          "^apps/api/src/platform/(?:http|kernel)/",
          "^packages/contracts/",
        ],
        path: "^apps/|^packages/",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "guild-infrastructure-isolation",
      comment:
        "Infrastructure may not import HTTP or another module's internals.",
      severity: "error",
      from: {
        path: "^apps/api/src/modules/([^/]+)/infrastructure/",
        pathNot: "[.](?:int[.])?test[.]ts$",
      },
      to: {
        path: [
          "^apps/api/src/modules/$1/http/",
          "^apps/api/src/modules/(?!$1/)[^/]+/(?!index[.]ts$).+",
        ],
      },
    },
    {
      name: "no-framework-in-core",
      comment:
        "Domain and application stay free of Hono, Drizzle, and Battle.net packages.",
      severity: "error",
      from: {
        path: "^apps/api/src/modules/[^/]+/(?:domain|application)/",
        pathNot: "[.](?:int[.])?test[.]ts$",
      },
      to: {
        path: "(^|/)(?:hono|drizzle-orm|postgres|pg|@blizzard-api)(/|$)",
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "dist", "coverage", "apps/model-baker"],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.base.json",
    },
    combinedDependencies: true,
    skipAnalysisNotInRules: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};
