#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
app = root / "client/src/App.tsx"
layout = root / "client/src/components/CRMLayout.tsx"

app_text = app.read_text(encoding="utf-8")
layout_text = layout.read_text(encoding="utf-8")

marker = "TAS_HELP_CENTER_INSYSTEM_LUXURY_V2"

# App routes: add internal protected route if missing.
route_anchor = '      <Route path="/tas/service">{() => <TASPermissionGuard module="service"><TASServicePage /></TASPermissionGuard>}</Route>'
internal_routes = '''      <Route path="/tas/help-center">{() => <TASPermissionGuard module="service"><HelpCenter /></TASPermissionGuard>}</Route>
      <Route path="/tas/help-center/:slug">{() => <TASPermissionGuard module="service"><HelpCenter /></TASPermissionGuard>}</Route>'''
if '/tas/help-center' not in app_text:
    if route_anchor not in app_text:
        raise SystemExit("ERROR=APP_SERVICE_ROUTE_ANCHOR_NOT_FOUND")
    app_text = app_text.replace(route_anchor, internal_routes + "\n" + route_anchor, 1)

# Redirect old standalone help routes into the in-system Help Center.
old_block = '''      <Route path="/help-center">{() => <Redirect to="/ar/help-center" />}</Route>
      <Route path="/help-center/article/:articleId">{(p: any) => <Redirect to={"/ar/help-center/article/" + p.articleId} />}</Route>
      <Route path="/help-center/:slug">{(p: any) => <Redirect to={"/ar/help-center/" + p.slug} />}</Route>
      <Route path="/ar/help-center" component={HelpCenter} />
      <Route path="/ar/help-center/article/:articleId" component={HelpCenter} />
      <Route path="/ar/help-center/:slug" component={HelpCenter} />
      <Route path="/en/help-center" component={HelpCenter} />
      <Route path="/en/help-center/article/:articleId" component={HelpCenter} />
      <Route path="/en/help-center/:slug" component={HelpCenter} />'''
new_block = '''      <Route path="/help-center">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/help-center/article/:articleId">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/help-center/:slug">{(p: any) => <Redirect to={"/tas/help-center/" + p.slug} />}</Route>
      <Route path="/ar/help-center">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/ar/help-center/article/:articleId">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/ar/help-center/:slug">{(p: any) => <Redirect to={"/tas/help-center/" + p.slug} />}</Route>
      <Route path="/en/help-center">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/en/help-center/article/:articleId">{() => <Redirect to="/tas/help-center" />}</Route>
      <Route path="/en/help-center/:slug">{(p: any) => <Redirect to={"/tas/help-center/" + p.slug} />}</Route>'''
if old_block in app_text:
    app_text = app_text.replace(old_block, new_block, 1)
elif 'component={HelpCenter}' in app_text and '/ar/help-center' in app_text:
    raise SystemExit("ERROR=OLD_HELP_ROUTE_BLOCK_CHANGED")

# Top-bar Help button must navigate inside TAS, same tab.
old_click = '''              onClick={() => {
                const helpPath = lang === "ar" ? "/ar/help-center" : "/en/help-center";
                window.open(helpPath, "_blank", "noopener,noreferrer");
              }}'''
new_click = '''              onClick={() => navigate("/tas/help-center")}'''
if old_click in layout_text:
    layout_text = layout_text.replace(old_click, new_click, 1)
elif 'window.open(helpPath' in layout_text:
    raise SystemExit("ERROR=HELP_BUTTON_BLOCK_CHANGED")

layout_text = layout_text.replace(
    "            {/* Help Center: opens in a new tab because the help center has an independent public layout. */}",
    "            {/* Help Center: in-system TAS workspace. */}",
    1,
)

# Add Help Center to the Automotive sidebar group beside Service.
sidebar_anchor = '        customSidebarItem("/automotive/service", isRTL ? "الصيانة والمواعيد" : "Service Booking", <Calendar size={15} />, TAS_SERVICE_ROLES),'
sidebar_item = '        customSidebarItem("/tas/help-center", isRTL ? "مركز مساعدة الصيانة" : "Service Help Center", <HelpCircle size={15} />, TAS_SERVICE_ROLES),'
if sidebar_item not in layout_text:
    if sidebar_anchor not in layout_text:
        raise SystemExit("ERROR=AUTOMOTIVE_SERVICE_SIDEBAR_ANCHOR_NOT_FOUND")
    layout_text = layout_text.replace(sidebar_anchor, sidebar_anchor + "\n" + sidebar_item, 1)

app.write_text(app_text, encoding="utf-8")
layout.write_text(layout_text, encoding="utf-8")
print("ROUTES_AND_SHELL_TRANSFORM=PASS")
