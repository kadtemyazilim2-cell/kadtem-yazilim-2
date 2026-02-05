'use server';

export async function debugPing() {
    console.log('[DebugAction] Ping received');
    await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
    return { success: true, message: 'Pong from Server' };
}
