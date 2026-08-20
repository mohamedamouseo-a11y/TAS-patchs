import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { CarFront, Pencil, Plus, RotateCcw, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type FormState = {
  id?: number;
  code: string;
  nameEn: string;
  nameAr: string;
  aliases: string;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY: FormState = { code: "", nameEn: "", nameAr: "", aliases: "", sortOrder: "0", isActive: true };

export default function VehicleBrandsSettings() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(EMPTY);
  const brandsQuery = trpc.tas.vehicleBrands.list.useQuery({ activeOnly: false });
  const createMutation = trpc.tas.vehicleBrands.create.useMutation({
    onSuccess: async () => {
      await utils.tas.vehicleBrands.list.invalidate();
      setForm(EMPTY);
      toast.success(isRTL ? "تمت إضافة الماركة" : "Vehicle brand added");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateMutation = trpc.tas.vehicleBrands.update.useMutation({
    onSuccess: async () => {
      await utils.tas.vehicleBrands.list.invalidate();
      setForm(EMPTY);
      toast.success(isRTL ? "تم تحديث الماركة" : "Vehicle brand updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const brands = useMemo(() => brandsQuery.data ?? [], [brandsQuery.data]);

  const submit = () => {
    const payload = {
      code: form.code,
      nameEn: form.nameEn,
      nameAr: form.nameAr,
      aliases: form.aliases.split(",").map((value) => value.trim()).filter(Boolean),
      sortOrder: Number(form.sortOrder || 0),
      isActive: form.isActive,
    };
    if (!payload.code.trim() || !payload.nameEn.trim()) {
      toast.error(isRTL ? "الكود والاسم الإنجليزي مطلوبان" : "Code and English name are required");
      return;
    }
    if (form.id) updateMutation.mutate({ id: form.id, ...payload });
    else createMutation.mutate(payload);
  };

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <CarFront size={18} />
          {isRTL ? "ماركات السيارات" : "Vehicle Brands"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {isRTL
            ? "مصدر مركزي واحد للماركات المستخدمة في الكتالوج ورفع Excel وباقي وحدات TAS. الماركة غير النشطة تبقى محفوظة تاريخيًا وتختفي من الاختيارات الجديدة."
            : "One central source for brands used by the catalog, Excel import, and TAS modules. Inactive brands stay historically linked but disappear from new selections."}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 items-end">
          <div>
            <label className="text-xs font-medium">{isRTL ? "الكود *" : "Code *"}</label>
            <Input value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} placeholder="TOYOTA" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">{isRTL ? "الاسم الإنجليزي *" : "English name *"}</label>
            <Input value={form.nameEn} onChange={(e) => setForm((v) => ({ ...v, nameEn: e.target.value }))} placeholder="Toyota" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">{isRTL ? "الاسم العربي" : "Arabic name"}</label>
            <Input value={form.nameAr} onChange={(e) => setForm((v) => ({ ...v, nameAr: e.target.value }))} placeholder="تويوتا" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">{isRTL ? "أسماء بديلة" : "Aliases"}</label>
            <Input value={form.aliases} onChange={(e) => setForm((v) => ({ ...v, aliases: e.target.value }))} placeholder="Toyota Motor, تويوتا" className="mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium">{isRTL ? "الترتيب" : "Sort order"}</label>
            <Input type="number" value={form.sortOrder} onChange={(e) => setForm((v) => ({ ...v, sortOrder: e.target.value }))} className="mt-1" />
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-2 px-2">
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((v) => ({ ...v, isActive: checked }))} />
              <span className="text-xs">{isRTL ? "نشطة" : "Active"}</span>
            </div>
            <Button onClick={submit} disabled={isSaving} size="sm" className="gap-1.5">
              {form.id ? <Save size={14} /> : <Plus size={14} />}
              {form.id ? (isRTL ? "حفظ" : "Save") : (isRTL ? "إضافة" : "Add")}
            </Button>
            {form.id && (
              <Button variant="outline" size="icon" onClick={() => setForm(EMPTY)} title={isRTL ? "إلغاء التعديل" : "Cancel edit"}>
                <RotateCcw size={14} />
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 overflow-hidden">
          {brandsQuery.isLoading ? (
            <div className="p-5 text-sm text-muted-foreground">{isRTL ? "جاري تحميل الماركات..." : "Loading brands..."}</div>
          ) : brands.length === 0 ? (
            <div className="p-5 text-sm text-muted-foreground">{isRTL ? "لا توجد ماركات بعد." : "No vehicle brands yet."}</div>
          ) : (
            <div className="divide-y divide-border/60">
              {brands.map((brand: any) => (
                <div key={brand.id} className="p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{isRTL ? (brand.nameAr || brand.nameEn) : brand.nameEn}</span>
                      <Badge variant="outline">{brand.code}</Badge>
                      <Badge variant={Number(brand.isActive) === 1 ? "default" : "secondary"}>
                        {Number(brand.isActive) === 1 ? (isRTL ? "نشطة" : "Active") : (isRTL ? "غير نشطة" : "Inactive")}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {(brand.aliases ?? []).length ? (brand.aliases ?? []).join(" • ") : (isRTL ? "بدون أسماء بديلة" : "No aliases")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setForm({
                      id: Number(brand.id),
                      code: brand.code ?? "",
                      nameEn: brand.nameEn ?? "",
                      nameAr: brand.nameAr ?? "",
                      aliases: (brand.aliases ?? []).join(", "),
                      sortOrder: String(brand.sortOrder ?? 0),
                      isActive: Number(brand.isActive) === 1,
                    })}
                  >
                    <Pencil size={14} /> {isRTL ? "تعديل" : "Edit"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
