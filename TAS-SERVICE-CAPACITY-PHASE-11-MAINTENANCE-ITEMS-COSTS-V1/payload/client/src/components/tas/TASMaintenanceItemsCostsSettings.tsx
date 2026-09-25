import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { FieldGroup, FieldLabel, SectionCard, formatEGP } from '@/components/tas/TASShared';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Boxes, Calculator, CircleDollarSign, ClipboardList, PackageCheck, Pencil, Plus, Save, Wrench } from 'lucide-react';

const ITEM_TYPES = ['Part', 'Fluid', 'Consumable', 'Labor', 'Operation', 'Other'] as const;
const ACTIONS = ['Replace', 'Inspect', 'Clean', 'Adjust', 'Lubricate', 'TopUp', 'Other'] as const;

// PACKAGE_TOTALS

type ItemForm = {
  id: number | null;
  code: string;
  name: string;
  itemType: string;
  unit: string;
  partNumber: string;
  defaultUnitCostEgp: string;
  defaultUnitPriceEgp: string;
  defaultVatRatePct: string;
  preparationRequired: boolean;
  notes: string;
};

type LineForm = {
  id: number | null;
  itemId: string;
  action: string;
  quantity: string;
  unitCostEgp: string;
  unitPriceEgp: string;
  vatRatePct: string;
  preparationRequired: boolean;
  notes: string;
};

const emptyItemForm = (): ItemForm => ({
  id: null, code: '', name: '', itemType: 'Part', unit: 'unit', partNumber: '',
  defaultUnitCostEgp: '0', defaultUnitPriceEgp: '0', defaultVatRatePct: '0',
  preparationRequired: true, notes: '',
});

const emptyLineForm = (): LineForm => ({
  id: null, itemId: '', action: 'Replace', quantity: '1',
  unitCostEgp: '0', unitPriceEgp: '0', vatRatePct: '0',
  preparationRequired: true, notes: '',
});

function moneyNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function TASMaintenanceItemsCostsSettings() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const itemsQ = trpc.tas.service.listMaintenanceItems.useQuery({ includeInactive: true });
  const plansQ = trpc.tas.service.listMaintenancePlans.useQuery({ includeInactive: false });
  const items: any[] = itemsQ.data ?? [];
  const plans: any[] = plansQ.data ?? [];

  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedIntervalId, setSelectedIntervalId] = useState('');
  const [lineForm, setLineForm] = useState<LineForm>(emptyLineForm);

  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) setSelectedPlanId(String(plans[0].id));
  }, [plans, selectedPlanId]);

  const intervalsQ = trpc.tas.service.listMaintenanceIntervals.useQuery({
    planId: Number(selectedPlanId || 0),
    includeInactive: false,
  }, { enabled: Number(selectedPlanId || 0) > 0 });

  const intervals: any[] = intervalsQ.data ?? [];

  useEffect(() => {
    if (!intervals.length) {
      setSelectedIntervalId('');
      return;
    }
    if (!intervals.some((row: any) => String(row.id) === selectedIntervalId)) {
      setSelectedIntervalId(String(intervals[0].id));
    }
  }, [intervals, selectedIntervalId]);

  const packageQ = trpc.tas.service.getMaintenanceIntervalPackage.useQuery({
    intervalId: Number(selectedIntervalId || 0),
  }, { enabled: Number(selectedIntervalId || 0) > 0 });

  const packageData: any = packageQ.data;
  const lines: any[] = packageData?.lines ?? [];
  const summary: any = packageData?.summary ?? {};

  const selectedItem = useMemo(
    () => items.find((row: any) => String(row.id) === lineForm.itemId),
    [items, lineForm.itemId],
  );

  const refreshItems = async () => {
    await utils.tas.service.listMaintenanceItems.invalidate();
  };

  const refreshPackage = async () => {
    await utils.tas.service.getMaintenanceIntervalPackage.invalidate({
      intervalId: Number(selectedIntervalId || 0),
    });
  };

  const createItem = trpc.tas.service.createMaintenanceItem.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم حفظ عنصر الصيانة' : 'Maintenance item saved');
      setItemForm(emptyItemForm());
      await refreshItems();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateItem = trpc.tas.service.updateMaintenanceItem.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث عنصر الصيانة' : 'Maintenance item updated');
      setItemForm(emptyItemForm());
      await Promise.all([refreshItems(), refreshPackage()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const createLine = trpc.tas.service.createMaintenanceIntervalItem.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تمت إضافة العنصر إلى باقة الصيانة' : 'Item added to maintenance package');
      setLineForm(emptyLineForm());
      await refreshPackage();
    },
    onError: (error) => toast.error(error.message),
  });

  const updateLine = trpc.tas.service.updateMaintenanceIntervalItem.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? 'تم تحديث سطر الباقة' : 'Package line updated');
      setLineForm(emptyLineForm());
      await refreshPackage();
    },
    onError: (error) => toast.error(error.message),
  });

  const saveItem = () => {
    if (!itemForm.name.trim()) {
      toast.error(isRTL ? 'اسم العنصر مطلوب' : 'Item name is required');
      return;
    }
    const payload = {
      ...(itemForm.id ? { id: itemForm.id } : {}),
      code: itemForm.code.trim() || null,
      name: itemForm.name.trim(),
      itemType: itemForm.itemType,
      unit: itemForm.unit.trim() || 'unit',
      partNumber: itemForm.partNumber.trim() || null,
      defaultUnitCostEgp: moneyNumber(itemForm.defaultUnitCostEgp),
      defaultUnitPriceEgp: moneyNumber(itemForm.defaultUnitPriceEgp),
      defaultVatRatePct: moneyNumber(itemForm.defaultVatRatePct),
      preparationRequired: itemForm.preparationRequired,
      notes: itemForm.notes.trim() || null,
      isActive: true,
    };
    if (itemForm.id) updateItem.mutate(payload);
    else createItem.mutate(payload);
  };

  const editItem = (item: any) => {
    setItemForm({
      id: Number(item.id),
      code: String(item.code ?? ''),
      name: String(item.name ?? ''),
      itemType: String(item.itemType ?? 'Part'),
      unit: String(item.unit ?? 'unit'),
      partNumber: String(item.partNumber ?? ''),
      defaultUnitCostEgp: String(item.defaultUnitCostEgp ?? 0),
      defaultUnitPriceEgp: String(item.defaultUnitPriceEgp ?? 0),
      defaultVatRatePct: String(item.defaultVatRatePct ?? 0),
      preparationRequired: Number(item.preparationRequired) === 1,
      notes: String(item.notes ?? ''),
    });
  };

  const toggleItem = (item: any) => {
    updateItem.mutate({ id: Number(item.id), isActive: Number(item.isActive) !== 1 });
  };

  const chooseLineItem = (itemId: string) => {
    const item = items.find((row: any) => String(row.id) === itemId);
    setLineForm((current) => ({
      ...current,
      itemId,
      unitCostEgp: String(item?.defaultUnitCostEgp ?? 0),
      unitPriceEgp: String(item?.defaultUnitPriceEgp ?? 0),
      vatRatePct: String(item?.defaultVatRatePct ?? 0),
      preparationRequired: Number(item?.preparationRequired) === 1,
    }));
  };

  const saveLine = () => {
    const intervalId = Number(selectedIntervalId || 0);
    if (!intervalId || !lineForm.itemId) {
      toast.error(isRTL ? 'اختر Interval وعنصر صيانة' : 'Select an interval and maintenance item');
      return;
    }
    const payload = {
      ...(lineForm.id ? { id: lineForm.id } : {}),
      intervalId,
      itemId: Number(lineForm.itemId),
      action: lineForm.action,
      quantity: Number(lineForm.quantity || 1),
      unitCostEgp: moneyNumber(lineForm.unitCostEgp),
      unitPriceEgp: moneyNumber(lineForm.unitPriceEgp),
      vatRatePct: moneyNumber(lineForm.vatRatePct),
      preparationRequired: lineForm.preparationRequired,
      notes: lineForm.notes.trim() || null,
      isActive: true,
    };
    if (lineForm.id) updateLine.mutate(payload);
    else createLine.mutate(payload);
  };

  const editLine = (line: any) => {
    setLineForm({
      id: Number(line.id),
      itemId: String(line.itemId),
      action: String(line.action ?? 'Replace'),
      quantity: String(line.quantity ?? 1),
      unitCostEgp: String(line.unitCostEgp ?? 0),
      unitPriceEgp: String(line.unitPriceEgp ?? 0),
      vatRatePct: String(line.vatRatePct ?? 0),
      preparationRequired: Boolean(line.preparationRequired),
      notes: String(line.notes ?? ''),
    });
  };

  return (
    <SectionCard
      title={isRTL ? 'عناصر وتكاليف الصيانة' : 'Maintenance items & costs'}
      subtitle={isRTL
        ? 'كتالوج القطع والزيوت والمصنعية وربطها بكل مرحلة صيانة مع التكلفة والسعر والضريبة.'
        : 'Catalog parts, fluids, labor and operations, then price every maintenance interval package.'}
      right={<Badge className="border-0 bg-[#0a1f44] text-white"><Calculator size={12} className="me-1.5" />Phase 11</Badge>}
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
            <div className="mb-4 flex items-center gap-2">
              <Boxes size={16} className="text-[#0a1f44]" />
              <div>
                <div className="text-sm font-bold text-zinc-900">{isRTL ? 'كتالوج عناصر الصيانة' : 'Maintenance item catalog'}</div>
                <div className="text-[11px] text-zinc-400">{isRTL ? 'لا توجد أسعار مفترضة؛ كل قيمة تدخل صراحة.' : 'No assumed pricing; every value is explicit.'}</div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldGroup><FieldLabel>{isRTL ? 'الاسم' : 'Name'}</FieldLabel><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></FieldGroup>
              <FieldGroup><FieldLabel>{isRTL ? 'الكود' : 'Code'}</FieldLabel><Input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} /></FieldGroup>
              <FieldGroup>
                <FieldLabel>{isRTL ? 'النوع' : 'Type'}</FieldLabel>
                <Select value={itemForm.itemType} onValueChange={(value) => setItemForm({ ...itemForm, itemType: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ITEM_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
                </Select>
              </FieldGroup>
              <FieldGroup><FieldLabel>{isRTL ? 'الوحدة' : 'Unit'}</FieldLabel><Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="unit / liter / hour" /></FieldGroup>
              <FieldGroup><FieldLabel>Part Number</FieldLabel><Input value={itemForm.partNumber} onChange={(e) => setItemForm({ ...itemForm, partNumber: e.target.value })} /></FieldGroup>
              <FieldGroup><FieldLabel>{isRTL ? 'تكلفة الوحدة' : 'Unit cost'}</FieldLabel><Input type="number" min={0} step="0.01" value={itemForm.defaultUnitCostEgp} onChange={(e) => setItemForm({ ...itemForm, defaultUnitCostEgp: e.target.value })} /></FieldGroup>
              <FieldGroup><FieldLabel>{isRTL ? 'سعر الوحدة' : 'Unit price'}</FieldLabel><Input type="number" min={0} step="0.01" value={itemForm.defaultUnitPriceEgp} onChange={(e) => setItemForm({ ...itemForm, defaultUnitPriceEgp: e.target.value })} /></FieldGroup>
              <FieldGroup><FieldLabel>VAT %</FieldLabel><Input type="number" min={0} max={100} step="0.01" value={itemForm.defaultVatRatePct} onChange={(e) => setItemForm({ ...itemForm, defaultVatRatePct: e.target.value })} /></FieldGroup>
              <FieldGroup>
                <FieldLabel>{isRTL ? 'تحضير مسبق' : 'Preparation required'}</FieldLabel>
                <Select value={itemForm.preparationRequired ? 'yes' : 'no'} onValueChange={(value) => setItemForm({ ...itemForm, preparationRequired: value === 'yes' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="yes">{isRTL ? 'نعم' : 'Yes'}</SelectItem><SelectItem value="no">{isRTL ? 'لا' : 'No'}</SelectItem></SelectContent>
                </Select>
              </FieldGroup>
            </div>

            <FieldGroup className="mt-3"><FieldLabel>{isRTL ? 'ملاحظات' : 'Notes'}</FieldLabel><Textarea rows={2} value={itemForm.notes} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} /></FieldGroup>

            <div className="mt-4 flex gap-2">
              <Button onClick={saveItem} disabled={createItem.isPending || updateItem.isPending} className="bg-[#0a1f44] text-white hover:bg-[#0d2550]">
                {itemForm.id ? <Save size={14} className="me-1.5" /> : <Plus size={14} className="me-1.5" />}
                {itemForm.id ? (isRTL ? 'حفظ التعديل' : 'Save changes') : (isRTL ? 'إضافة عنصر' : 'Add item')}
              </Button>
              {itemForm.id && <Button variant="outline" onClick={() => setItemForm(emptyItemForm())}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>}
            </div>
          </div>

          <div className="max-h-[430px] overflow-auto rounded-2xl border border-zinc-100">
            <Table>
              <TableHeader><TableRow><TableHead>{isRTL ? 'العنصر' : 'Item'}</TableHead><TableHead>{isRTL ? 'النوع' : 'Type'}</TableHead><TableHead>{isRTL ? 'السعر' : 'Price'}</TableHead><TableHead>{isRTL ? 'الحالة' : 'State'}</TableHead><TableHead className="w-[90px]"></TableHead></TableRow></TableHeader>
              <TableBody>
                {items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell><div className="font-semibold text-zinc-800">{item.name}</div><div className="mt-0.5 text-[10px] text-zinc-400">{item.code || item.partNumber || ('#' + item.id)}</div></TableCell>
                    <TableCell className="text-xs text-zinc-600">{item.itemType}</TableCell>
                    <TableCell className="text-xs text-zinc-600">{formatEGP(item.defaultUnitPriceEgp)}</TableCell>
                    <TableCell><Badge variant="outline" className={Number(item.isActive) === 1 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-zinc-50 text-zinc-400'}>{Number(item.isActive) === 1 ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'متوقف' : 'Inactive')}</Badge></TableCell>
                    <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => editItem(item)}><Pencil size={12} /></Button><Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => toggleItem(item)}>{Number(item.isActive) === 1 ? (isRTL ? 'إيقاف' : 'Off') : (isRTL ? 'تفعيل' : 'On')}</Button></div></TableCell>
                  </TableRow>
                ))}
                {!items.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-xs text-zinc-400">{isRTL ? 'لا توجد عناصر بعد.' : 'No maintenance items yet.'}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <FieldGroup>
              <FieldLabel>{isRTL ? 'خطة الصيانة' : 'Maintenance plan'}</FieldLabel>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}><SelectTrigger><SelectValue placeholder={isRTL ? 'اختر الخطة' : 'Select plan'} /></SelectTrigger><SelectContent>{plans.map((plan: any) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name}</SelectItem>)}</SelectContent></Select>
            </FieldGroup>
            <FieldGroup>
              <FieldLabel>{isRTL ? 'المرحلة / Mileage' : 'Interval / mileage'}</FieldLabel>
              <Select value={selectedIntervalId} onValueChange={setSelectedIntervalId}><SelectTrigger><SelectValue placeholder={isRTL ? 'اختر المرحلة' : 'Select interval'} /></SelectTrigger><SelectContent>{intervals.map((interval: any) => <SelectItem key={interval.id} value={String(interval.id)}>{Number(interval.mileageKm).toLocaleString('en-US')} km{interval.label ? ' • ' + interval.label : ''}</SelectItem>)}</SelectContent></Select>
            </FieldGroup>
          </div>

          {selectedIntervalId && (
            <>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400"><ClipboardList size={12} />{isRTL ? 'السطور' : 'Lines'}</div><div className="mt-1 text-xl font-black text-zinc-900">{Number(summary.lineCount ?? 0)}</div></div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'التكلفة' : 'Cost'}</div><div className="mt-1 text-lg font-black text-zinc-900">{formatEGP(summary.costSubtotalEgp)}</div></div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4"><div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{isRTL ? 'قبل الضريبة' : 'Before VAT'}</div><div className="mt-1 text-lg font-black text-zinc-900">{formatEGP(summary.priceSubtotalEgp)}</div></div>
                <div className="rounded-2xl border border-[#c99a2e]/20 bg-[#fffaf0] p-4"><div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#9a6b12]"><CircleDollarSign size={12} />{isRTL ? 'الإجمالي' : 'Total'}</div><div className="mt-1 text-lg font-black text-[#7c5711]">{formatEGP(summary.totalEgp)}</div><div className="mt-0.5 text-[10px] text-[#a98035]">VAT {formatEGP(summary.vatEgp)}</div></div>
              </div>

              <div className="rounded-2xl border border-zinc-100 bg-white p-4">
                <div className="mb-4 flex items-center gap-2"><Wrench size={16} className="text-[#0a1f44]" /><div className="text-sm font-bold text-zinc-900">{lineForm.id ? (isRTL ? 'تعديل سطر الباقة' : 'Edit package line') : (isRTL ? 'إضافة سطر للباقة' : 'Add package line')}</div></div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <FieldGroup className="xl:col-span-2"><FieldLabel>{isRTL ? 'العنصر' : 'Item'}</FieldLabel><Select value={lineForm.itemId} onValueChange={chooseLineItem}><SelectTrigger><SelectValue placeholder={isRTL ? 'اختر عنصرًا نشطًا' : 'Select active item'} /></SelectTrigger><SelectContent>{items.filter((item: any) => Number(item.isActive) === 1).map((item: any) => <SelectItem key={item.id} value={String(item.id)}>{item.name} • {item.itemType}</SelectItem>)}</SelectContent></Select></FieldGroup>
                  <FieldGroup><FieldLabel>{isRTL ? 'الإجراء' : 'Action'}</FieldLabel><Select value={lineForm.action} onValueChange={(value) => setLineForm({ ...lineForm, action: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTIONS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></FieldGroup>
                  <FieldGroup><FieldLabel>{isRTL ? 'الكمية' : 'Quantity'}</FieldLabel><Input type="number" min={0.001} step="0.001" value={lineForm.quantity} onChange={(e) => setLineForm({ ...lineForm, quantity: e.target.value })} /></FieldGroup>
                  <FieldGroup><FieldLabel>{isRTL ? 'تكلفة الوحدة' : 'Unit cost'}</FieldLabel><Input type="number" min={0} step="0.01" value={lineForm.unitCostEgp} onChange={(e) => setLineForm({ ...lineForm, unitCostEgp: e.target.value })} /></FieldGroup>
                  <FieldGroup><FieldLabel>{isRTL ? 'سعر الوحدة' : 'Unit price'}</FieldLabel><Input type="number" min={0} step="0.01" value={lineForm.unitPriceEgp} onChange={(e) => setLineForm({ ...lineForm, unitPriceEgp: e.target.value })} /></FieldGroup>
                  <FieldGroup><FieldLabel>VAT %</FieldLabel><Input type="number" min={0} max={100} step="0.01" value={lineForm.vatRatePct} onChange={(e) => setLineForm({ ...lineForm, vatRatePct: e.target.value })} /></FieldGroup>
                  <FieldGroup><FieldLabel>{isRTL ? 'تحضير مسبق' : 'Preparation required'}</FieldLabel><Select value={lineForm.preparationRequired ? 'yes' : 'no'} onValueChange={(value) => setLineForm({ ...lineForm, preparationRequired: value === 'yes' })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">{isRTL ? 'نعم' : 'Yes'}</SelectItem><SelectItem value="no">{isRTL ? 'لا' : 'No'}</SelectItem></SelectContent></Select></FieldGroup>
                </div>
                <FieldGroup className="mt-3"><FieldLabel>{isRTL ? 'ملاحظات السطر' : 'Line notes'}</FieldLabel><Textarea rows={2} value={lineForm.notes} onChange={(e) => setLineForm({ ...lineForm, notes: e.target.value })} /></FieldGroup>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button onClick={saveLine} disabled={createLine.isPending || updateLine.isPending} className="bg-[#0a1f44] text-white hover:bg-[#0d2550]">{lineForm.id ? <Save size={14} className="me-1.5" /> : <Plus size={14} className="me-1.5" />}{lineForm.id ? (isRTL ? 'حفظ السطر' : 'Save line') : (isRTL ? 'إضافة للباقة' : 'Add to package')}</Button>
                  {lineForm.id && <Button variant="outline" onClick={() => setLineForm(emptyLineForm())}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>}
                  {selectedItem && <div className="ms-auto text-[11px] text-zinc-400">{selectedItem.unit || 'unit'} • {selectedItem.partNumber || (isRTL ? 'بدون Part Number' : 'No part number')}</div>}
                </div>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-zinc-100">
                <Table>
                  <TableHeader><TableRow><TableHead>{isRTL ? 'العنصر' : 'Item'}</TableHead><TableHead>{isRTL ? 'الإجراء' : 'Action'}</TableHead><TableHead>{isRTL ? 'الكمية' : 'Qty'}</TableHead><TableHead>{isRTL ? 'السعر' : 'Price'}</TableHead><TableHead>VAT</TableHead><TableHead>{isRTL ? 'الإجمالي' : 'Total'}</TableHead><TableHead>{isRTL ? 'تحضير' : 'Prep'}</TableHead><TableHead className="w-[90px]"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {lines.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell><div className="font-semibold text-zinc-800">{line.itemName}</div><div className="mt-0.5 text-[10px] text-zinc-400">{line.itemCode || line.partNumber || line.itemType}</div></TableCell>
                        <TableCell className="text-xs text-zinc-600">{line.action}</TableCell>
                        <TableCell className="text-xs text-zinc-600">{Number(line.quantity).toLocaleString('en-US')} {line.unit}</TableCell>
                        <TableCell className="text-xs text-zinc-600">{formatEGP(line.priceBeforeVatEgp)}</TableCell>
                        <TableCell className="text-xs text-zinc-600">{Number(line.vatRatePct).toFixed(2)}%</TableCell>
                        <TableCell className="font-semibold text-zinc-800">{formatEGP(line.totalEgp)}</TableCell>
                        <TableCell>{line.preparationRequired ? <Badge className="bg-amber-100 text-amber-700"><PackageCheck size={11} className="me-1" />{isRTL ? 'مطلوب' : 'Yes'}</Badge> : <span className="text-xs text-zinc-300">—</span>}</TableCell>
                        <TableCell><div className="flex gap-1"><Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => editLine(line)}><Pencil size={12} /></Button><Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => updateLine.mutate({ id: Number(line.id), isActive: false })}>{isRTL ? 'إيقاف' : 'Off'}</Button></div></TableCell>
                      </TableRow>
                    ))}
                    {!lines.length && <TableRow><TableCell colSpan={8} className="py-10 text-center text-xs text-zinc-400">{isRTL ? 'لا توجد عناصر مربوطة بهذه المرحلة بعد.' : 'No package lines for this interval yet.'}</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>

              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-[11px] leading-5 text-zinc-500">
                {isRTL
                  ? 'عند إنشاء حجز Premium لهذه المرحلة، TAS يحفظ Snapshot مستقل من السطور والأسعار داخل الحجز. أي تعديل لاحق في Master Data لا يغير الحجز القديم.'
                  : 'When a Premium booking uses this interval, TAS stores an independent snapshot of these lines and prices. Later master-data edits do not rewrite historical bookings.'}
              </div>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
