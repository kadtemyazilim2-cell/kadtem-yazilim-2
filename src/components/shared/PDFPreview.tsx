'use client';

import { useState, useEffect } from 'react';

interface PDFPreviewProps {
    base64: string;
}

export const PDFPreview = ({ base64 }: PDFPreviewProps) => {
    const [url, setUrl] = useState<string | null>(null);
    const [scale, setScale] = useState(1);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (!base64) return;
        try {
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            setUrl(blobUrl);

            const updateScale = () => {
                // Use clientWidth instead of innerWidth to exclude potential scrollbar width causing overflow
                const screenWidth = document.documentElement.clientWidth;
                const mobile = screenWidth < 768;
                setIsMobile(mobile);
                if (!mobile) {
                    // Use 660px base to focus on content and eliminate side gaps
                    setScale(screenWidth / 660);
                }
            };
            updateScale();
            window.addEventListener('resize', updateScale);
            return () => {
                URL.revokeObjectURL(blobUrl);
                window.removeEventListener('resize', updateScale);
            };
        } catch (e) {
            console.error("PDF Preview Error:", e);
            setUrl(null);
        }
    }, [base64]);

    if (!url) return <div className="flex items-center justify-center h-40 text-sm text-slate-500">Önizleme hazırlanıyor...</div>;

    if (isMobile) {
        return (
            <div className="w-full h-full bg-white p-0 m-0 overflow-hidden">
                <iframe 
                    src={`${url}#view=FitH&toolbar=0&navpanes=0`} 
                    className="w-full h-full border-0 block shadow-none" 
                    title="PDF Preview" 
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white overflow-y-auto overflow-x-hidden p-0 m-0">
            <div 
                style={{ 
                    width: '660px',
                    height: `${660 * 1.414}px`, // A4 Ratio
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    backgroundColor: 'white',
                    margin: '0 auto'
                }}
                className="relative"
            >
                <iframe 
                    src={`${url}#view=FitH&toolbar=0&navpanes=0`} 
                    className="w-full h-full border-0 block" 
                    title="PDF Preview" 
                />
            </div>
        </div>
    );
};
