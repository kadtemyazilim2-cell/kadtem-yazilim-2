export function serializeData(data: any): any {
    if (Array.isArray(data)) {
        return data.map(serializeData);
    }
    if (data !== null && typeof data === 'object') {
        // Handle Date objects
        if (data instanceof Date) {
            return data.toISOString();
        }
        // Handle Decimal (if using Prisma decimal, but we used float/int mostly) or other objects
        const newObj: any = {};
        for (const key in data) {
            newObj[key] = serializeData(data[key]);
        }
        return newObj;
    }
    return data;
}
