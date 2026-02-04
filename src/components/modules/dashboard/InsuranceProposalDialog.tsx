import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store/use-store";
import { Mail, User, Check, Settings, AlertCircle } from "lucide-react";
import { SmtpSettingsDialog } from "./SmtpSettingsDialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

import { updateVehicle as updateVehicleAction } from "@/actions/vehicle"; // [NEW]

interface InsuranceProposalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: {
        id: string;
        vehicleId: string;
        plate: string;
        type: string;
        date: string;
        vehicleBrand?: string;
        vehicleModel?: string;
    } | null;
}

export function InsuranceProposalDialog({ open, onOpenChange, item }: InsuranceProposalDialogProps) {
    const { institutions, vehicles, companies, smtpConfig: globalSmtpConfig, updateVehicle: updateVehicleStore } = useAppStore(); // [RENAME]
    const [sending, setSending] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [selectedAgencyIds, setSelectedAgencyIds] = useState<string[]>([]);
    const [progress, setProgress] = useState<{ current: number, total: number } | null>(null);

    // [NEW] Customization States
    const [policyType, setPolicyType] = useState<string>(item?.type || ''); // Auto-select default
    const [customNote, setCustomNote] = useState<string>(''); // Additional note

    // Get vehicle and its company for SMTP check
    const vehicle = item ? vehicles.find((v: any) => v.id === item.vehicleId) : null;
    const vehicleCompany = vehicle ? companies.find((c: any) => c.id === vehicle.companyId) : null;

    // Determine effective SMTP Config (Company specific > Global > Null)
    const companySmtp = vehicleCompany?.smtpHost ? {
        host: vehicleCompany.smtpHost,
        port: vehicleCompany.smtpPort,
        secure: vehicleCompany.smtpSecure,
        auth: {
            user: vehicleCompany.smtpUser,
            pass: vehicleCompany.smtpPass
        },
        fromEmail: vehicleCompany.smtpFromEmail,
        fromName: vehicleCompany.smtpFromName
    } : null;

    const effectiveSmtpConfig = companySmtp || vehicleCompany?.smtpConfig || globalSmtpConfig;
    const canUseSmtp = !!(effectiveSmtpConfig && effectiveSmtpConfig.host);

    // Filter agencies
    const agencies = institutions
        .filter((i: any) => i.category === 'INSURANCE_AGENCY' || i.category === 'INSURANCE_COMPANY')
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'tr'));

    // Load preferences and auto-select on open
    useEffect(() => {
        if (open && item) {
            // Reset fields
            setPolicyType(item.type || ''); // Auto-select type
            setCustomNote('');

            const saved = localStorage.getItem('preferredProposalAgencies');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Filter to ensure they still exist
                    const validIds = parsed.filter((id: string) => agencies.some((a: any) => a.id === id));
                    setSelectedAgencyIds(validIds);
                } catch (e) { console.error(e); }
            }
        }
    }, [open, item?.id]);

    const handleToggleAgency = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedAgencyIds(prev => [...prev, id]);
        } else {
            setSelectedAgencyIds(prev => prev.filter(x => x !== id));
        }
    };

    const handleSendBatch = async () => {
        if (!item || selectedAgencyIds.length === 0) return;

        if (!policyType) {
            alert("Lütfen bir Poliçe Tipi seçiniz.");
            return;
        }

        // Persist selection
        localStorage.setItem('preferredProposalAgencies', JSON.stringify(selectedAgencyIds));

        if (!canUseSmtp) {
            alert("Otomatik gönderim için aracın bağlı olduğu firma veya genel ayarlarda SMTP yapılandırması bulunamadı. Lütfen Ayarlar'dan ekleyiniz.");
            return;
        }

        setSending(true);
        let successCount = 0;
        let failCount = 0;

        const targets = agencies.filter((a: any) => selectedAgencyIds.includes(a.id));
        setProgress({ current: 0, total: targets.length });

        for (let i = 0; i < targets.length; i++) {
            const agency = targets[i];
            setProgress({ current: i + 1, total: targets.length });

            try {
                if (!agency.email) throw new Error("Email adresi yok");

                const subject = `${item.plate} - ${policyType} Yenileme Talebi`;

                // Construct Body
                // Template:
                // Merhaba,
                // <Boşluk>
                // Ekli ruhsatı bulunan [PLAKA] plakalı aracımızın süresi dolan [TIP] poliçesi için yenileme teklif çalışmasının yapılmasını rica ederim.
                // <Boşluk>
                // [EK NOT] (Varsa)
                // <Boşluk>
                // İyi çalışmalar.

                let body = `Merhaba,\n\nEkli ruhsatı bulunan ${item.plate} plakalı aracımızın süresi dolan ${policyType} poliçesi için yenileme teklif çalışmasının yapılmasını rica ederim.`;

                if (customNote && customNote.trim() !== '') {
                    body += `\n\n${customNote}`;
                }

                body += `\n\nİyi çalışmalar.`;

                let attachments = [];
                if (vehicle?.licenseFile) {
                    const content = vehicle.licenseFile.includes('base64,')
                        ? vehicle.licenseFile.split('base64,')[1]
                        : vehicle.licenseFile;

                    attachments.push({
                        filename: `ruhsat-${item.plate}.pdf`,
                        content: content
                    });
                }

                const res = await fetch('/api/send-mail', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        smtpConfig: effectiveSmtpConfig,
                        to: agency.email,
                        subject,
                        text: body,
                        attachments
                    })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Sunucu hatası");
                }
                successCount++;

            } catch (error: any) {
                console.error(`Error sending to ${agency.name}:`, error);
                failCount++;
            }
        }

        setSending(false);
        setProgress(null);

        if (failCount === 0) {
            // [NEW] Update Vehicle History on Success
            const now = new Date().toISOString();
            const agencyNames = agencies
                .filter((a: any) => selectedAgencyIds.includes(a.id))
                .map((a: any) => a.name);

            // [FIX] Update Server DB first
            try {
                const updatePayload: any = {};
                if (policyType.toLowerCase().includes('trafik')) {
                    updatePayload.lastTrafficProposalDate = now;
                    updatePayload.lastTrafficProposalAgencies = agencyNames;
                } else if (policyType.toLowerCase().includes('kasko')) {
                    updatePayload.lastKaskoProposalDate = now;
                    updatePayload.lastKaskoProposalAgencies = agencyNames;
                }

                const result = await updateVehicleAction(item.vehicleId, updatePayload);

                if (result.success) {
                    // Update Local Store
                    updateVehicleStore(item.vehicleId, updatePayload);
                } else {
                    console.error('Update failed:', result.error);
                }
            } catch (err) {
                console.error('Update error:', err);
            }

            alert(`Başarıyla ${successCount} acenteye teklif isteği gönderildi.`);
            onOpenChange(false);
        } else {
            alert(`${successCount} gönderildi, ${failCount} başarısız oldu. Lütfen konsolu kontrol ediniz.`);
        }
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Teklif İsteği Gönder (Otomatik)</DialogTitle>
                    <DialogDescription>
                        <span className="font-semibold text-slate-900">{item.plate}</span> aracı için <span className="font-semibold text-slate-900">{policyType}</span> teklifi istenecek acenteleri seçiniz.
                        {vehicleCompany && <span className="block mt-1 text-xs text-blue-600">Firma: {vehicleCompany.name} (SMTP: {vehicleCompany.smtpHost || vehicleCompany.smtpConfig ? 'Mevcut' : 'Yok, Global Kullanılacak'})</span>}
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
                    {!canUseSmtp && (
                        <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            <div>
                                <strong>SMTP Ayarı Eksik!</strong>
                                <p>Otomatik gönderim için bu firmanın veya sistemin mail ayarlarının yapılması gerekmektedir.</p>
                                <Button variant="link" onClick={() => setSettingsOpen(true)} className="p-0 h-auto text-amber-900 underline">Ayarları Yapılandır</Button>
                            </div>
                        </div>
                    )}



                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <div className="text-sm font-medium text-slate-500">Acente Listesi <span className="text-red-500">*</span></div>
                            <div className="text-xs text-muted-foreground">
                                {selectedAgencyIds.length} seçili
                            </div>
                        </div>

                        <ScrollArea className="h-[200px] border rounded-md p-2">
                            {agencies.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    Kayıtlı acente bulunamadı.
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {agencies.map((agency: any) => (
                                        <div key={agency.id} className="flex items-center space-x-3 p-2 hover:bg-slate-50 rounded-md border border-transparent hover:border-slate-100 transition-colors">
                                            <Checkbox
                                                id={`agency-${agency.id}`}
                                                checked={selectedAgencyIds.includes(agency.id)}
                                                onCheckedChange={(c) => handleToggleAgency(agency.id, c as boolean)}
                                                disabled={!agency.email}
                                            />
                                            <div className="flex-1">
                                                <label
                                                    htmlFor={`agency-${agency.id}`}
                                                    className={`text-sm font-medium cursor-pointer flex items-center gap-2 ${!agency.email ? 'text-muted-foreground' : ''}`}
                                                >
                                                    {agency.name}
                                                    {agency.category === 'INSURANCE_COMPANY' && <Badge variant="secondary" className="text-[10px] h-4 px-1">Firma</Badge>}
                                                </label>
                                                {!agency.email && <div className="text-[10px] text-red-500">E-posta adresi yok</div>}
                                            </div>
                                            {agency.email && <div className="text-xs text-muted-foreground">{agency.email}</div>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* [NEW] Custom Note Area */}
                    <div className="space-y-2">
                        <Label>Ek Bilgi / Not (Opsiyonel)</Label>
                        <Textarea
                            placeholder="Mail içeriğine eklemek istediğiniz notu buraya yazabilirsiniz..."
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            className="bg-slate-50 min-h-[80px]"
                        />
                        <p className="text-[10px] text-muted-foreground">
                            * Yazacağınız not "teklif çalışmasının yapılmasını rica ederim." cümlesinin altına eklenecektir.
                        </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={sending}>
                            Vazgeç
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                            onClick={handleSendBatch}
                            disabled={sending || !canUseSmtp || selectedAgencyIds.length === 0 || !policyType}
                        >
                            {sending ? (
                                <span className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    Gönderiliyor ({progress?.current}/{progress?.total})
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Mail className="w-4 h-4" />
                                    Seçili Acentelere Gönder ({selectedAgencyIds.length})
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>

            {/* Global Settings Dialog */}
            <SmtpSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Dialog>
    );
}
