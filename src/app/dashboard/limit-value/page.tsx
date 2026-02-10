import { LimitValueCalculation } from '@/components/modules/limit-value/LimitValueCalculation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LimitValuePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Sınır Değer Hesaplama</h1>
                <p className="text-muted-foreground">
                    4734 Sayılı Kamu İhale Kanunu kapsamında sınır değer hesabı ve tenzilat analizi.
                </p>
            </div>

            <LimitValueCalculation />
        </div>
    );
}
