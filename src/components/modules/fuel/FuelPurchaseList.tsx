import { useAuth } from '@/lib/store/use-auth'; // [NEW]

// ... inside component ...
export function FuelPurchaseList({ isWidget = false }: FuelPurchaseListProps) {
    const { fuelTransfers, fuelTanks, sites } = useAppStore();
    const { user, hasPermission } = useAuth(); // [NEW]
    const canEdit = user?.role === 'ADMIN' || hasPermission('movement.purchase', 'EDIT'); // [NEW]

    // ... existing code ...

    displayPurchases.map((t: any) => (
        <TableRow
            key={t.id}
            className={canEdit ? "cursor-pointer hover:bg-slate-50 transition-colors" : "cursor-default opacity-90"}
            onClick={() => {
                if (canEdit) {
                    setSelectedTransfer(t);
                    setIsEditDialogOpen(true);
                }
            }}
        >
            <TableCell className="font-mono text-xs">{format(new Date(t.date), 'dd.MM.yyyy HH:mm')}</TableCell>
            <TableCell className="font-medium text-slate-700">
                {getEntityName(t.fromType, t.fromId)}
            </TableCell>
            <TableCell>
                <ArrowRight className="w-4 h-4 text-slate-400" />
            </TableCell>
            <TableCell className="font-medium text-slate-700">
                {getEntityName(t.toType, t.toId)}
            </TableCell>
            <TableCell className="text-right font-bold text-slate-900">
                {t.amount.toLocaleString('tr-TR')} Lt
            </TableCell>
            <TableCell className="text-right text-slate-600 font-mono">
                {t.unitPrice ? `${t.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : '-'}
            </TableCell>
            <TableCell className="text-right font-medium text-emerald-700 font-mono">
                {t.totalCost ? `${t.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺` : (t.amount * (t.unitPrice || 0)).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺'}
            </TableCell>
        </TableRow>
    ))
                            )
}
                        </TableBody >
                    </Table >

    {/* Show More Button - Only in Full Mode (Pagination style) */ }
{
    !isWidget && filteredPurchases.length > 10 && (
        <div className="flex justify-center mt-4 border-t pt-2">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAll(!showAll)}
                className="text-slate-500 hover:text-slate-800 gap-2 w-full sm:w-auto"
            >
                {showAll ? (
                    <>
                        <ChevronUp className="w-4 h-4" />
                        Listeyi Küçült
                    </>
                ) : (
                    <>
                        <ChevronDown className="w-4 h-4" />
                        Daha Fazla Göster (+{filteredPurchases.length - 10})
                    </>
                )}
            </Button>
        </div>
    )
}
                </CardContent >

    { selectedTransfer && (
        <FuelPurchaseEditDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            transfer={selectedTransfer}
        />
    )}
            </Card >

    {/* Dialog for Full List */ }
    < Dialog open = { isFullListOpen } onOpenChange = { setIsFullListOpen } >
        <DialogContent className="max-w-[98vw] w-[98vw] sm:max-w-[98vw] max-h-[95vh] h-[95vh] overflow-y-auto p-6">
            <FuelPurchaseList isWidget={false} />
        </DialogContent>
            </Dialog >
        </>
    );
}
