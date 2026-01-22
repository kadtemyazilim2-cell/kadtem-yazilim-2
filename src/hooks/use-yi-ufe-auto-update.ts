import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store/use-store';

export function useYiUfeAutoUpdate() {
    const { yiUfeRates, addYiUfeRates } = useAppStore();
    const [updating, setUpdating] = useState(false);

    const fetchYiUfeFromApi = async () => {
        setUpdating(true);
        try {
            // Use Server Action for reliable scraping
            const { syncYiUfeRates, getYiUfeRates } = await import('@/actions/yiufe');

            // 1. Run Sync
            await syncYiUfeRates();

            // 2. Fetch fresh data
            const res = await getYiUfeRates();
            if (res.success && res.data) {
                // Determine format
                const ratesWithId = res.data.map((r: any) => ({
                    id: r.id || `${r.year}-${r.month}`,
                    year: r.year,
                    month: r.month,
                    index: r.index
                }));
                addYiUfeRates(ratesWithId);
                console.log('YI-UFE Auto-Update Successful via Server Action');
                return true;
            }
            return false;
        } catch (e) {
            console.error('YI-UFE Auto-Update Failed', e);
            return false;
        } finally {
            setUpdating(false);
        }
    };

    useEffect(() => {
        const checkAndFetch = async () => {
            const now = new Date();
            const day = now.getDate();
            const hour = now.getHours();
            const minute = now.getMinutes();

            // Condition: 3rd of month, Time >= 10:05.
            if (day === 3 && (hour > 10 || (hour === 10 && minute >= 5))) {
                // Check if we already have data for the *previous* month
                const prevDate = new Date();
                prevDate.setMonth(prevDate.getMonth() - 1);
                const targetYear = prevDate.getFullYear();
                const targetMonth = prevDate.getMonth() + 1; // 1-12

                const hasData = yiUfeRates.some((r: any) => r.year === targetYear && r.month === targetMonth);

                if (hasData) {
                    console.log('YI-UFE: Data for previous month already exists. Skipping auto-fetch.');
                    return;
                }

                if (updating) return;

                console.log('YI-UFE: Auto-fetch triggered (Client Side Condition Met).');
                // We use the new Server Action which does the real scraping
                // We can reuse the same function `fetchYiUfeFromApi` if we update it, or call here directly.
                // Let's rely on the updated fetchYiUfeFromApi below which we should update to use Server Action.
                await fetchYiUfeFromApi();
            }
        };

        // Run check immediately on mount
        checkAndFetch();

        // Retry every 5 minutes (300,000 ms) until we have data
        const intervalId = setInterval(checkAndFetch, 5 * 60 * 1000);

        return () => clearInterval(intervalId);
    }, [yiUfeRates, updating, addYiUfeRates]);

    return { updating };
}
