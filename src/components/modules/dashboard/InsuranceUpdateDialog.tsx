import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { updateVehicle } from "@/actions/vehicle";
import { useAppStore } from "@/lib/store/use-store";
import { toast } from "sonner";

interface InsuranceUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: {
        id: string; // Alert ID
        vehicleId: string;
        plate: string;
        type: string; // 'Trafik Sigortası' | 'Kasko' | 'Muayene'
        agencyName?: string;
        date: string; // Expiry Date
    } | null;
}

export function InsuranceUpdateDialog({ open, onOpenChange, item }: InsuranceUpdateDialogProps) {
    const { institutions, updateVehicle: updateStoreVehicle } = useAppStore();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [companyName, setCompanyName] = useState(""); // Insurance Company
    const [agencyName, setAgencyName] = useState("");   // Agency
    const [cost, setCost] = useState("");

    // Identify mode
    const isTraffic = item?.type === 'Trafik Sigortası';
    const isKasko = item?.type === 'Kasko';

    // Lists
    const insuranceCompanies = institutions.filter((i: any) => i.category === 'INSURANCE_COMPANY');
    const agencies = institutions.filter((i: any) => i.category === 'INSURANCE_AGENCY');

    useEffect(() => {
        if (open && item) {
            // Reset and Set Defaults
            // Default Start Date = Old Expiry Date + 1 Day? Or Today?
            // Usually renewal starts from expiry.
            if (item.date) {
                const expiry = new Date(item.date);
                setStartDate(expiry.toISOString().split('T')[0]); // Suggest Expiry as Start

                // Suggest End Date = Start + 1 Year
                const end = new Date(expiry);
                end.setFullYear(end.getFullYear() + 1);
                setEndDate(end.toISOString().split('T')[0]);
            } else {
                setStartDate(new Date().toISOString().split('T')[0]);
                setEndDate("");
            }

            setCompanyName("");
            setAgencyName(item.agencyName || ""); // Pre-fill if known
            setCost("");
        }
    }, [open, item]);

    const handleSave = async () => {
        if (!startDate || !endDate) {
            toast.error("Lütfen başlangıç ve bitiş tarihlerini giriniz.");
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: any = {};

            if (isTraffic) {
                payload.insuranceStartDate = new Date(startDate);
                payload.insuranceExpiry = new Date(endDate);
                if (companyName) payload.insuranceCompany = companyName;
                if (agencyName) payload.insuranceAgency = agencyName;
                if (cost) payload.insuranceCost = Number(cost);
            } else if (isKasko) {
                payload.kaskoStartDate = new Date(startDate);
                payload.kaskoExpiry = new Date(endDate);
                if (companyName) payload.kaskoCompany = companyName;
                if (agencyName) payload.kaskoAgency = agencyName;
                if (cost) payload.kaskoCost = Number(cost);
            }

            const res = await updateVehicle(item!.vehicleId, payload);

            if (res.success) {
                toast.success(`${item?.type} güncellendi.`);

                // Update Store
                // We need to construct the update object for the store
                const storeUpdate: any = {};
                if (isTraffic) {
                    storeUpdate.insuranceStartDate = payload.insuranceStartDate.toISOString();
                    storeUpdate.insuranceExpiry = payload.insuranceExpiry.toISOString();
                    if (companyName) storeUpdate.insuranceCompany = companyName;
                    if (agencyName) storeUpdate.insuranceAgency = agencyName;
                    if (cost) storeUpdate.insuranceCost = Number(cost);
                } else if (isKasko) {
                    storeUpdate.kaskoStartDate = payload.kaskoStartDate.toISOString();
                    storeUpdate.kaskoExpiry = payload.kaskoExpiry.toISOString();
                    if (companyName) storeUpdate.kaskoCompany = companyName;
                    if (agencyName) storeUpdate.kaskoAgency = agencyName;
                    if (cost) storeUpdate.kaskoCost = Number(cost);
                }
                updateStoreVehicle(item!.vehicleId, storeUpdate);

                onOpenChange(false);
            } else {
                toast.error(res.error || "Güncelleme başarısız.");
            }
        } catch (error) {
            console.error(error);
            toast.error("Bir hata oluştu.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{item.type} Yenileme</DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold">{item.plate}</span> aracı için yeni poliçe bilgilerini giriniz.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Başlangıç Tarihi</Label>
                            <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bitiş Tarihi</Label>
                            <Input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Sigorta Firması</Label>
                        <Select value={companyName} onValueChange={setCompanyName}>
                            <SelectTrigger>
                                <SelectValue placeholder="Firma Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {insuranceCompanies.map((c: any) => (
                                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Acente</Label>
                        <Select value={agencyName} onValueChange={setAgencyName}>
                            <SelectTrigger>
                                <SelectValue placeholder="Acente Seçiniz" />
                            </SelectTrigger>
                            <SelectContent>
                                {agencies.map((a: any) => (
                                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Poliçe Tutarı (TL)</Label>
                        <Input
                            type="number"
                            value={cost}
                            onChange={(e) => setCost(e.target.value)}
                            placeholder="0.00"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Kaydet
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
