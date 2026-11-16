import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { parseRosterSearch } from "../features/roster-filter";
import { useLocale } from "../shared/i18n";
import { searchNumber } from "../shared/lib";
import { StatusBlock } from "../shared/ui";
import { PortalShell } from "../widgets/portal-shell";
import { parseRecipeFilters } from "../entities/recipe";
import { NotFoundPage } from "../pages/not-found";

function RouterError() {
  const { t } = useLocale();
  return <StatusBlock tone="error">{t("status.error")}</StatusBlock>;
}

const rootRoute = createRootRoute({
  component: PortalShell,
  notFoundComponent: NotFoundPage,
  errorComponent: RouterError,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("../pages/guild"), "GuildPage"),
});

const membersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/members",
  validateSearch: parseRosterSearch,
  component: lazyRouteComponent(
    () => import("../pages/members"),
    "MembersPage",
  ),
});

const professionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/professions",
  validateSearch: parseRecipeFilters,
  component: lazyRouteComponent(
    () => import("../pages/professions"),
    "ProfessionsPage",
  ),
});

const characterRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/characters/$characterSlug",
  component: lazyRouteComponent(
    () => import("../pages/character"),
    "CharacterPage",
  ),
});

const labCinematicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab/cinematic",
  validateSearch: (search: Record<string, unknown>) => ({
    frame: searchNumber(search.frame),
  }),
  component: lazyRouteComponent(
    () => import("../pages/lab"),
    "CinematicLabPage",
  ),
});

const labViewerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab/viewer",
  component: lazyRouteComponent(() => import("../pages/lab"), "ViewerLabPage"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  membersRoute,
  professionsRoute,
  characterRoute,
  labCinematicRoute,
  labViewerRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});
