import { useAuth } from '@/lib/store/use-auth'; // [NEW]

// ... inside component ...
export function SiteLogSummary({ siteLogEntries, sites, users }: SiteLogSummaryProps) {
    const { user, hasPermission } = useAuth(); // [NEW]
    const canPrint = user?.role === 'ADMIN' || hasPermission('dashboard', 'EDIT'); // [NEW] Only Editors can print report

    const [isGenerating, setIsGenerating] = useState<string | null>(null);

    // ... existing code ...

    <Button
        variant="ghost"
        size="icon"
        className={canPrint ? "h-6 w-6 text-slate-400 hover:text-blue-600" : "h-6 w-6 text-slate-200 cursor-not-allowed"}
        title="Önizle (Tüm Gün)"
        onClick={(e) => {
            if (!canPrint) {
                e.preventDefault();
                return;
            }
            handleDownloadPDF(firstItem, true);
        }}
        disabled={isItemLoading || !canPrint}
    >
        {isItemLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
    </Button>
                                                    </div >

        {/* Row 2: Weather (Combined or First) */ }
    {
        group.weather && (
            <div className="mb-1.5">
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded inline-block max-w-full truncate" title={group.weather}>
                    {group.weather}
                </span>
            </div>
        )
    }

    {/* Row 3: Contents (Stacked) */ }
    <div className="space-y-2">
        {group.items.map((log: any) => {
            const author = users.find((u: any) => u.id === log.authorId);
            return (
                <div key={log.id}>
                    <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed mb-0.5" title={log.content}>
                        {log.content}
                    </p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <User className="w-3 h-3" />
                        <span className="truncate">{author?.name || 'Bilinmeyen'}</span>
                    </div>
                </div>
            );
        })}
    </div>
                                                </div >
                                            );
})}
                                </div >
                            </CardContent >
                        </Card >
                    );
                })}
            </div >
        </div >
    );
}
