'use server';

export async function testPing() {
    const fs = await import('fs');
    const logFile = 'C:\\Users\\Drone\\Desktop\\takip-sistemi\\debug-attendance.log';
    try { fs.appendFileSync(logFile, `${new Date().toISOString()} - [PING] testPing called\n`); } catch (e) { }
    console.log('[SERVER] testPing called successfully at ' + new Date().toISOString());
    return { success: true, message: 'Pong' };
}

