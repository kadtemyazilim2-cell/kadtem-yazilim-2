'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppStore } from '@/lib/store/use-store';
import { SmtpConfig } from '@/lib/types';
import { Switch } from '@/components/ui/switch'; // Assuming we have switch or checkbox. If not, I'll use simple check.
import { Checkbox } from '@/components/ui/checkbox';

interface SmtpSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function SmtpSettingsDialog({ open, onOpenChange }: SmtpSettingsDialogProps) {
    const { smtpConfig, updateSmtpConfig } = useAppStore();
    const [formData, setFormData] = useState<SmtpConfig>({
        host: '',
        port: 587,
        secure: false,
        auth: {
            user: '',
            pass: ''
        },
        fromEmail: '',
        fromName: ''
    });

    useEffect(() => {
        if (open && smtpConfig) {
            setFormData(smtpConfig);
        }
    }, [open]); // Only run when dialog opens to reset form

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateSmtpConfig(formData);
        onOpenChange(false);
        alert('SMTP Ayarları kaydedildi.');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>SMTP Mail Ayarları</DialogTitle>
                    <DialogDescription>
                        Otomatik mail gönderimi için sunucu bilgilerinizi giriniz.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Host (Sunucu) <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="smtp.gmail.com"
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Port <span className="text-red-500">*</span></Label>
                            <Input
                                type="number"
                                placeholder="587"
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="secure"
                            checked={formData.secure}
                            onCheckedChange={(checked) => setFormData({ ...formData, secure: checked as boolean })}
                        />
                        <Label htmlFor="secure">SSL/TLS (Genellikle 465 portu için)</Label>
                    </div>

                    <div className="space-y-2">
                        <Label>Kullanıcı Adı (E-posta) <span className="text-red-500">*</span></Label>
                        <Input
                            placeholder="mail@sirketiniz.com"
                            value={formData.auth.user}
                            onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, user: e.target.value } })}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Şifre <span className="text-red-500">*</span></Label>
                        <Input
                            type="password"
                            placeholder="****"
                            value={formData.auth.pass}
                            onChange={(e) => setFormData({ ...formData, auth: { ...formData.auth, pass: e.target.value } })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Gönderen Adı <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="Şirket Adı"
                                value={formData.fromName}
                                onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Gönderen E-posta <span className="text-red-500">*</span></Label>
                            <Input
                                placeholder="Tekrar e-posta adresi"
                                value={formData.fromEmail}
                                onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="submit">Kaydet</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
