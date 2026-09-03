import assert from "node:assert/strict"
import test from "node:test"
import { BEAUTY_NAV_PROFILE, resolveNavProfile, type VerticalNavProfile } from "./nav-profile"
import {
  getDayOfMonth,
  isMobileNavHrefActive,
  isMoreDestinationActive,
  msUntilNextLocalDay,
  resolveActiveMobileNavItemId,
  resolveMobileHeaderChrome,
  resolveVerticalMobileNav,
} from "./mobile-nav"

const TEAM = { includedSeats: 5 }
const SOLO = { includedSeats: 1 }

test("Beauty mobile bar is My salon · Today · Messages, in order (mic is not a nav item)", () => {
  const nav = resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, TEAM)
  assert.ok(nav)
  assert.deepEqual(nav.primary.map((i) => i.id), ["my-salon", "today", "mensajes"])
  assert.deepEqual(nav.primary.map((i) => i.href), ["/", "/today", "/inbox"])
})

test("Beauty More sheet holds every other visible destination, in declared order", () => {
  const nav = resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, TEAM)!
  assert.deepEqual(nav.more.map((i) => i.id), [
    "agenda",
    "clientas",
    "marketing",
    "cobros",
    "servicios",
    "equipo",
    "forte",
  ])
  // Marketing left the primary mobile navigation but stays reachable via More.
  assert.ok(nav.more.some((i) => i.id === "marketing" && i.href === "/contenido"))
})

test("mobile nav never invents a destination: every href is one of the profile's own", () => {
  const nav = resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, TEAM)!
  const declared = new Set(BEAUTY_NAV_PROFILE.items.map((i) => i.href))
  for (const item of [...nav.primary, ...nav.more]) {
    assert.ok(declared.has(item.href), `${item.id} → ${item.href} is not a profile route`)
  }
  // No route is lost: primary ∪ more === visible profile items.
  assert.equal(nav.primary.length + nav.more.length, BEAUTY_NAV_PROFILE.items.length)
})

test("Solo workspaces hide Team from More (same policy as the sidebar); loading hides it too", () => {
  assert.ok(!resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, SOLO)!.more.some((i) => i.id === "equipo"))
  assert.ok(
    !resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, { includedSeats: undefined })!.more.some(
      (i) => i.id === "equipo",
    ),
  )
  assert.ok(resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, { includedSeats: null })!.more.some((i) => i.id === "equipo"))
})

test("profiles without a mobile declaration render no bar; null profile → null", () => {
  const noMobile: VerticalNavProfile = { ...BEAUTY_NAV_PROFILE, mobile: undefined }
  assert.equal(resolveVerticalMobileNav(noMobile, TEAM), null)
  assert.equal(resolveVerticalMobileNav(null, TEAM), null)
  assert.equal(resolveVerticalMobileNav(undefined, TEAM), null)
  // Non-beauty verticals resolve to no profile → no bar (no accidental Finesse behavior).
  assert.equal(resolveVerticalMobileNav(resolveNavProfile("creative-agency"), TEAM), null)
})

test("unknown primaryIds are ignored instead of crashing", () => {
  const weird: VerticalNavProfile = { ...BEAUTY_NAV_PROFILE, mobile: { primaryIds: ["ghost", "today"] } }
  const nav = resolveVerticalMobileNav(weird, TEAM)!
  assert.deepEqual(nav.primary.map((i) => i.id), ["today"])
})

test("active destination: root is exact, others match self + sub-routes", () => {
  assert.equal(isMobileNavHrefActive("/", "/"), true)
  assert.equal(isMobileNavHrefActive("/today", "/"), false)
  assert.equal(isMobileNavHrefActive("/today", "/today"), true)
  assert.equal(isMobileNavHrefActive("/today/x", "/today"), true)
  assert.equal(isMobileNavHrefActive("/todayx", "/today"), false)
  assert.equal(isMobileNavHrefActive("/inbox", "/inbox"), true)
})

test("Beauty active state resolves for bar and More destinations", () => {
  const nav = resolveVerticalMobileNav(BEAUTY_NAV_PROFILE, TEAM)!
  assert.equal(resolveActiveMobileNavItemId("/", nav), "my-salon")
  assert.equal(resolveActiveMobileNavItemId("/today", nav), "today")
  assert.equal(resolveActiveMobileNavItemId("/inbox", nav), "mensajes")
  assert.equal(resolveActiveMobileNavItemId("/inbox/overview", nav), "mensajes")
  assert.equal(resolveActiveMobileNavItemId("/contenido", nav), "marketing")
  assert.equal(resolveActiveMobileNavItemId("/calendario/semana", nav), "agenda")
  assert.equal(resolveActiveMobileNavItemId("/forte/improvements", nav), "forte")
  assert.equal(resolveActiveMobileNavItemId("/notificaciones", nav), null)
  assert.equal(isMoreDestinationActive("/contenido", nav), true)
  assert.equal(isMoreDestinationActive("/clientes/123", nav), true)
  assert.equal(isMoreDestinationActive("/today", nav), false)
  assert.equal(isMoreDestinationActive("/notificaciones", nav), false)
})

test("Today glyph: local day of month and next-midnight refresh delay", () => {
  assert.equal(getDayOfMonth(new Date(2026, 8, 3, 15, 30)), 3)
  assert.equal(getDayOfMonth(new Date(2026, 0, 31, 23, 59)), 31)
  const at = new Date(2026, 8, 3, 23, 0, 0, 0)
  // 1h to midnight + 1s guard.
  assert.equal(msUntilNextLocalDay(at), 60 * 60 * 1000 + 1000)
  // Just before midnight still yields a positive delay (guard clamps to ≥1s).
  assert.ok(msUntilNextLocalDay(new Date(2026, 8, 3, 23, 59, 59, 999)) >= 1000)
  // Across a month boundary.
  assert.equal(msUntilNextLocalDay(new Date(2026, 8, 30, 12, 0, 0, 0)), 12 * 60 * 60 * 1000 + 1000)
})

test("mobile header: with the bottom bar, Today trigger and Menu leave the header (no duplicate primary nav)", () => {
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: true, focused: false, onToday: false }), {
    showTodayTrigger: false,
    showMenu: false,
  })
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: true, focused: false, onToday: true }), {
    showTodayTrigger: false,
    showMenu: false,
  })
})

test("mobile header: Inbox-focused mode keeps the Menu (Smart Inbox views, not primary nav)", () => {
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: true, focused: true, onToday: false }), {
    showTodayTrigger: false,
    showMenu: true,
  })
})

test("mobile header: workspaces without a bottom bar keep today's header exactly", () => {
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: false, focused: false, onToday: false }), {
    showTodayTrigger: true,
    showMenu: true,
  })
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: false, focused: false, onToday: true }), {
    showTodayTrigger: false,
    showMenu: true,
  })
  assert.deepEqual(resolveMobileHeaderChrome({ hasMobileBar: false, focused: true, onToday: false }), {
    showTodayTrigger: true,
    showMenu: true,
  })
})
