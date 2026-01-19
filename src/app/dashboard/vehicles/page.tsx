import { VehicleList } from '@/components/modules/vehicles/VehicleList';

export default function VehiclesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Araçlar ve İş Makineleri</h2>
                <p className="text-muted-foreground">
                    Şirket bünyesindeki tüm araç, kamyon ve iş makinelerini buradan yönetebilirsiniz.
                </p>
            </div>
            <VehicleList />
        </div>
    );
}
