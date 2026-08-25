import type { ReactNode } from "react";
import CRMLayout from "@/components/CRMLayout";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTasRbac, type TasRbacAction, type TasRbacModule } from "@/lib/tasRbac";

export default function TASPermissionGuard({
  module,
  action = "view",
  adminOnly = false,
  children,
}: {
  module: TasRbacModule;
  action?: TasRbacAction;
  adminOnly?: boolean;
  children: ReactNode;
}) {
  const { user, isAuthenticated } = useAuth();
  const { isRTL } = useLanguage();
  const rbac = useTasRbac(isAuthenticated);
  const isAdmin = ["Admin", "admin"].includes(String(user?.role ?? ""));

  if (rbac.isLoading || rbac.isFetching) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-9 w-9 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <span className="text-sm">{isRTL ? "جاري التحقق من الصلاحيات..." : "Checking permissions..."}</span>
        </div>
      </div>
    );
  }

  if (rbac.error || (adminOnly && !isAdmin) || !rbac.can(module, action)) {
    return (
      <CRMLayout>
        <div className="mx-auto flex min-h-[65vh] max-w-xl items-center justify-center p-6" dir={isRTL ? "rtl" : "ltr"}>
          <div className="w-full rounded-3xl border border-amber-200 bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-black text-foreground">
              {isRTL ? "ليس لديك صلاحية للوصول" : "You do not have access"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isRTL
                ? "هذه الصفحة محمية بنظام الصلاحيات. تواصل مع مسؤول النظام إذا كنت تحتاج إلى هذه الصلاحية."
                : "This page is protected by the permissions system. Contact an administrator if you need access."}
            </p>
            <div className="mt-5 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {module}.{action}
            </div>
          </div>
        </div>
      </CRMLayout>
    );
  }

  return <>{children}</>;
}
