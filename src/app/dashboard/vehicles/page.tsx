import { VehicleList } from '@/components/modules/vehicles/VehicleList';
import { auth } from '@/auth';

export default async function VehiclesPage() {
    const session = await auth();
    const user = session?.user;

    const canView = user?.role === 'ADMIN' ||
        user?.permissions?.['vehicles']?.includes('VIEW');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu sayfayı görüntüleme yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Araçlar ve İş Makineleri</h2>
                <p className="text-muted-foreground">
                    Şirket bünyesindeki tüm araç, kamyon ve iş makinelerini buradan yönetebilirsiniz.
                </p>
            </div>
            <VehicleList currentUser={user} />
        </div>
    );
}
