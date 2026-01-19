import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/lib/store/use-store";
import { useState, useEffect } from "react";
import { Vehicle } from "@/lib/types";

interface RentalUpdateDialogProps {
    vehicle: Vehicle;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RentalUpdateDialog({ vehicle, open, onOpenChange }: RentalUpdateDialogProps) {
    const { updateVehicle } = useAppStore();
    const [monthlyFee, setMonthlyFee] = useState<string>('');

    useEffect(() => {
        if (open && vehicle) {
            setMonthlyFee(vehicle.monthlyRentalFee?.toString() || '');
        }
    }, [open, vehicle]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const fee = parseFloat(monthlyFee);

        updateVehicle(vehicle.id, {
            monthlyRentalFee: isNaN(fee) ? 0 : fee,
            rentalLastUpdate: new Date().toISOString() // [NEW] Track update time
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Kira Bedeli Güncelle</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Plaka</Label>
                        <div className="font-mono font-bold text-slate-700 bg-slate-100 p-2 rounded">
                            {vehicle.plate}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Aylık Kira Bedeli (TL)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={monthlyFee}
                            onChange={(e) => setMonthlyFee(e.target.value)}
                            required
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            İptal
                        </Button>
                        <Button type="submit">
                            Kaydet
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
