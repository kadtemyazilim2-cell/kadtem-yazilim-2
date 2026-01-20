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

    const agencies = institutions.filter((i: any) => i.category === "INSURANCE_AGENCY")

    const handleAdd = () => {
        if (!newAgencyName.trim()) return

        addInstitution({
            id: crypto.randomUUID(),
            name: newAgencyName.trim(),
            category: "INSURANCE_AGENCY",
        })
        setNewAgencyName("")
    }

    const handleDelete = (id: string) => {
        if (confirm("Bu acenteyi silmek istediğinizden emin misiniz?")) {
            deleteInstitution(id)
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
