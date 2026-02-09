'use server';

export async function testPing() {
    console.log('[SERVER] testPing called successfully at ' + new Date().toISOString());
    return { success: true, message: 'Pong' };
}
