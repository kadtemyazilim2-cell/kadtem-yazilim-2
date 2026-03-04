import { useState } from "react"
import { useAppStore } from "@/lib/store/use-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Trash2, Plus } from "lucide-react"
import { createInstitution, deleteInstitution as deleteInstitutionAction } from "@/actions/institution"
import { toast } from "sonner"

interface AgencyManagerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function AgencyManagerDialog({
    open,
    onOpenChange,
}: AgencyManagerDialogProps) {
    const { institutions, addInstitution, deleteInstitution } = useAppStore()
    const [newAgencyName, setNewAgencyName] = useState("")

    const agencies = institutions.filter((i: any) => i.category === "INSURANCE_AGENCY" && i.status !== 'PASSIVE')

    const handleAdd = async () => {
        if (!newAgencyName.trim()) return

        try {
            const result = await createInstitution({
                name: newAgencyName.trim(),
                category: "INSURANCE_AGENCY",
                alignment: "center",
            })

            if (result.success && result.data) {
                addInstitution(result.data as any)
                toast.success("Acente eklendi.")
                setNewAgencyName("")
            } else {
                toast.error(result.error || "Acente eklenemedi.")
            }
        } catch (error) {
            console.error(error)
            toast.error("Bir hata oluştu.")
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Bu acenteyi silmek istediğinizden emin misiniz?")) {
            try {
                const result = await deleteInstitutionAction(id)
                if (result.success) {
                    deleteInstitution(id)
                    toast.success("Acente silindi.")
                } else {
                    toast.error(result.error || "Silme işlemi başarısız.")
                }
            } catch (error) {
                console.error(error)
                toast.error("Bir hata oluştu.")
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Sigorta Acentelerini Yönet</DialogTitle>
                    <DialogDescription>
                        Listeye yeni sigorta acentesi ekleyin veya mevcut olanları silin.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="flex items-end gap-2">
                        <div className="grid w-full gap-1.5">
                            <Label htmlFor="agency-name">Acente Adı</Label>
                            <Input
                                id="agency-name"
                                value={newAgencyName}
                                onChange={(e) => setNewAgencyName(e.target.value)}
                                placeholder="Örn: Anadolu Sigorta"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd()
                                }}
                            />
                        </div>
                        <Button onClick={handleAdd} disabled={!newAgencyName.trim()}>
                            <Plus className="h-4 w-4 mr-2" />
                            Ekle
                        </Button>
                    </div>

                    <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
                        {agencies.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                                Henüz eklenmiş acente yok.
                            </div>
                        ) : (
                            agencies.map((agency: any) => (
                                <div
                                    key={agency.id}
                                    className="flex items-center justify-between p-3 hover:bg-muted/50"
                                >
                                    <span className="font-medium">{agency.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => handleDelete(agency.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

