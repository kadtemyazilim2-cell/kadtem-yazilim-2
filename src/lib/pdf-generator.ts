
import { jsPDF } from 'jspdf';
import { addTurkishFont } from '@/lib/pdf-font';
import { format } from 'date-fns';
import { IKIKAT_LOGO_BASE64, KADTEM_LOGO_BASE64 } from '@/lib/logos';

export const generateCorrespondencePDF = (item: any, companies: any[], users: any[], isPreview = false) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    addTurkishFont(doc);
    const fontName = 'Roboto';
    doc.setFont(fontName, 'normal');

    const marginLeft = 25; // Standard 2.5cm
    const marginRight = 25;
    const marginTop = 20; // Standard 2cm top
    const marginBottom = 20;
    const contentWidth = 210 - marginLeft - marginRight;

    let yPos = marginTop;

    // Helper functions
    const getCompanyName = (id: string) => companies.find(c => c.id === id)?.name || '-';
    // const getUserName = (id: string) => users.find(u => u.id === id)?.name || 'Bilinmeyen'; // Unused in print logic for now

    // 1. Header (Logo)
    // 1. Header (Logo)
    const company = companies.find(c => c.id === item.companyId);
    const companyName = company?.name || '-';
    const normalizedName = companyName.toLocaleLowerCase('tr');

    let logoToUse: string | null | undefined = company?.letterhead || company?.logoUrl;

    // [FIX] Priority: Specific hardcoded logos (Text Headers) for known companies
    // User reported dynamic logos (Red/Blue IKIKAT) are "wrong", prefers the Text Header style (Preview).
    // Preview likely used fallback because dynamic logo failed to load.
    // We enforce the fallback for these specific companies.

    // [FIX] Priority: Specific hardcoded logos (Text Headers) for known companies
    // User reported dynamic logos (Red/Blue IKIKAT) are "wrong", prefers the Text Header style (Preview).
    // Preview likely used fallback because dynamic logo failed to load.
    // We enforce the fallback for these specific companies.

    if (!logoToUse) {
        // [CRITICAL] Explicitly prevent "Kenan Tugay" from getting the hardcoded Ikikat logo
        // This company should use its DB letterhead (if any) or text header
        if (normalizedName.includes('kenan')) {
            // Do NOTHING. Leave logoToUse as null/undefined.
            // This ensures we fall through to the "No Logo" / Text Header logic.
        }
        else if (normalizedName.includes('ikikat') || normalizedName.includes('ıkıkat')) {
            logoToUse = IKIKAT_LOGO_BASE64;
        }
        else if (normalizedName.includes('kad-tem') || normalizedName.includes('kadtem')) {
            logoToUse = KADTEM_LOGO_BASE64;
        }
    }

    if (logoToUse) {
        try {
            const imgProps = doc.getImageProperties(logoToUse);
            const pdfWidth = 160; // Slightly smaller to fit margins
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // Center Logo? Or Left? Usually Top Left or Center. 
            // Image example shows Top Left.
            doc.addImage(logoToUse, 'PNG', marginLeft, 10, pdfWidth, pdfHeight);
            yPos = 10 + pdfHeight + 10;
        } catch (e) {
            console.error("Error adding logo", e);
            yPos = 45;
        }
    } else {
        yPos += 15;
    }

    // 2. Date (Right Aligned)
    // Use item.date or current date if missing? handlePrint uses item.date.
    const dateStr = item.date ? format(new Date(item.date), 'dd.MM.yyyy') : format(new Date(), 'dd.MM.yyyy');
    doc.setFontSize(10);
    doc.setFont(fontName, 'normal');
    // Move Date up even more? User said "sayı ve konuyu 1 satır yukarı alalım"
    // Let's tighten the gap between Date and Number
    doc.text(dateStr, 210 - marginRight, yPos - 5, { align: 'right' });
    yPos += 5; // Reduced gap from 10 to 5

    // 3. Number (Sayı)
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.text('Sayı:', marginLeft, yPos);
    doc.setFont(fontName, 'normal');
    doc.text(item.referenceNumber || '-', marginLeft + 12, yPos);
    yPos += 8; // Reduced gap from 15 to 8 (Standard line height)


    // Removed Registration Number (Kayıt No) from PDF as per request
    // if (item.registrationNumber) {
    //     yPos += 5;
    //     doc.setFont(fontName, 'bold');
    //     doc.text('Kayıt No:', marginLeft, yPos);
    //     doc.setFont(fontName, 'normal');
    //     doc.text(item.registrationNumber, marginLeft + 20, yPos);
    // }
    // yPos += 6;

    // 6. Footer (Signature)
    const ySignature = 240;

    // Add Signature Label
    // ...

    // [FIX] Stamp Logic
    if (item.includeStamp && company?.stamp) {
        try {
            // Place stamp near signature area, slightly offset
            const stampWidth = 35;
            const stampHeight = 35; // Assume square-ish or adjust

            // Layout: Bottom Right for Stamp usually overlaps signature or is next to it.
            // Let's place it at: x=140, y=230 (Overlapping signature area slightly)
            doc.addImage(company.stamp, 'PNG', 140, 230, stampWidth, stampHeight);
        } catch (e) {
            console.error("Error adding stamp", e);
        }
    }



    // 4. Subject (Konu)
    doc.setFont(fontName, 'bold'); // Changed from "helvetica" to fontName
    doc.text('Konu:', marginLeft, yPos);
    doc.setFont(fontName, 'normal');
    const subjectText = item.subject || '';
    const subjectLines = doc.splitTextToSize(subjectText, contentWidth - 25);
    doc.text(subjectLines, marginLeft + 12, yPos);
    const subjectH = doc.getTextDimensions(subjectLines).h;
    yPos += Math.max(subjectH, 5) + 10; // Reduced gap from 15 to 10

    // 5. Recipient (Muhatap) - Centered & Bold 12pt
    // Move up 1 line
    doc.setFont(fontName, 'bold');
    doc.setFontSize(12);
    // Increase boldness/visibility by drawing twice or setting color if needed, but 'bold' font should suffice.
    // User asked for "koyu renkli", standard black is usually fine but let's ensure it's absolute black and maybe heavier?
    // JS PDF standard bold is usually enough, but let's ensure opacity/color.
    doc.setTextColor(0, 0, 0);
    const recipientText = (item.senderReceiver || '').toUpperCase();
    const recipientLines = doc.splitTextToSize(recipientText, contentWidth);

    // Calculate line height in mm (approximate for layout)
    // jsPDF uses points for font size, but document is in mm. 
    // 1 pt = 0.352778 mm. Default line height factor is 1.15.
    const lineHeightPt = doc.getFontSize() * 1.15;
    const lineHeightMm = lineHeightPt * 0.352778;

    if (recipientLines.length > 1) {
        // Draw all lines except last one normally (centered)
        for (let i = 0; i < recipientLines.length - 1; i++) {
            doc.text(recipientLines[i], 105, yPos, { align: 'center' });
            yPos += lineHeightMm;
        }

        // Draw last line aligned to the end of the previous line
        const prevLine = recipientLines[recipientLines.length - 2];
        const prevLineWidth = doc.getTextWidth(prevLine);
        // Center alignment: Starts at 105 - (Width/2), Ends at 105 + (Width/2)
        const prevLineEndX = 105 + (prevLineWidth / 2);

        const lastLine = recipientLines[recipientLines.length - 1];
        doc.text(lastLine, prevLineEndX, yPos);
        yPos += lineHeightMm;
    } else {
        // Single line - just center
        doc.text(recipientLines, 105, yPos, { align: 'center' });
        yPos += lineHeightMm;
    }

    // Add extra spacing after recipient block
    yPos += 10;

    // Calculate total height for record (though we updated yPos manually)
    // const recipH = doc.getTextDimensions(recipientLines).h; // No longer needed as we manually advanced yPos


    // 6. Interest (İlgi) - Moved below Recipient, NO Indent
    // "İlgideki paragraf boşluğunu geri silelim" -> No indent
    // item.interest might be undefined if not set
    if (item.interest && item.interest.length > 0) {
        doc.setFontSize(10);
        item.interest.forEach((int: string, idx: number) => {
            if (!int) return;
            const label = item.interest.length > 1 ? `İlgi ${String.fromCharCode(65 + idx)}:` : 'İlgi:';

            doc.setFont(fontName, 'bold');
            doc.text(label, marginLeft, yPos); // No indent

            doc.setFont(fontName, 'normal');
            // Adjust text indent relative to label
            const intLines = doc.splitTextToSize(int, contentWidth - 20);
            doc.text(intLines, marginLeft + 12, yPos);
            yPos += doc.getTextDimensions(intLines).h + 3;
        });
        yPos += 10;
    } else {
        yPos += 5;
    }

    // 7. Content (Dilekçe Metni) - Justified & Rich Text Support
    doc.setFontSize(10);
    doc.setFont(fontName, 'normal');

    const lineWidth = contentWidth; // Full width
    const firstLineIndent = 12.5; // ~1.25cm

    // Helper to measure word width with current font
    const getWordWidth = (word: string, bold: boolean, italic: boolean, underline: boolean) => {
        // Always use normal to prevent encoding issues with missing font variants
        doc.setFont(fontName, 'normal');
        return doc.getTextWidth(word);
    };

    // Parse HTML content from contentEditable
    // Simplification: Replace block tags with \n, and common entities
    let cleanDesc = (item.description || '')
        .replace(/<div>/g, '\n')
        .replace(/<\/div>/g, '')
        .replace(/<p>/g, '\n')
        .replace(/<\/p>/g, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/&nbsp;/g, ' ');

    // Split into paragraphs
    const paragraphs = cleanDesc.split('\n');

    paragraphs.forEach((para: string) => {
        if (!para.trim()) return;

        // Robust Tokenizer: Split by ANY tag
        // Capturing group ensures delimiters are included in result array
        const parts = para.split(/(<[^>]+>)/g).filter(p => p !== '');

        let tokens: { text: string, bold: boolean, italic: boolean, underline: boolean, width: number, isSpace: boolean }[] = [];
        let inBold = false;
        let inItalic = false;
        let inUnderline = false;

        parts.forEach(part => {
            // Check if it's a tag
            if (part.startsWith('<') && part.endsWith('>')) {
                const tag = part.toLowerCase();
                if (tag.includes('<b>') || tag.includes('<strong>')) { inBold = true; }
                else if (tag.includes('</b>') || tag.includes('</strong>')) { inBold = false; }
                else if (tag.includes('<i>') || tag.includes('<em>')) { inItalic = true; }
                else if (tag.includes('</i>') || tag.includes('<em>')) { inItalic = false; }
                else if (tag.includes('<u>')) { inUnderline = true; }
                else if (tag.includes('</u>')) { inUnderline = false; }
                // Ignore other tags (spans, etc) but DO NOT print them
                return;
            }

            // It's text content
            // Split by whitespace but keep delimiters
            const words = part.split(/(\s+)/g).filter(w => w !== '');
            words.forEach(w => {
                const wWidth = getWordWidth(w, inBold, inItalic, inUnderline);
                tokens.push({
                    text: w,
                    bold: inBold,
                    italic: inItalic,
                    underline: inUnderline,
                    width: wWidth,
                    isSpace: /^\s+$/.test(w)
                });
            });
        });

        // Line breaking and Justification
        let currentLine: typeof tokens = [];
        let currentLineWidth = 0;
        let isFirstLine = true;

        const printLine = (lineTokens: typeof tokens, justify: boolean) => {
            // Check for page overflow before printing line
            if (yPos + 5 > 280) {
                doc.addPage();
                yPos = 20;
            }

            const indent = isFirstLine ? firstLineIndent : 0;
            const availableWidth = lineWidth - indent;

            const textWidth = lineTokens.reduce((acc, t) => acc + t.width, 0);
            const spaceTokens = lineTokens.filter(t => t.isSpace);

            let extraSpace = 0;
            let spacePerToken = 0;

            if (justify && spaceTokens.length > 0) {
                const naturalWidth = textWidth;
                if (availableWidth > naturalWidth) {
                    extraSpace = availableWidth - naturalWidth;
                    spacePerToken = extraSpace / spaceTokens.length;
                }
            }

            let curX = marginLeft + indent;

            lineTokens.forEach(tok => {
                // Always Normal Font
                doc.setFont(fontName, 'normal');

                if (tok.isSpace) {
                    if (tok.underline) {
                        doc.setLineWidth(0.3);
                        doc.line(curX, yPos + 1.5, curX + tok.width + (justify ? spacePerToken : 0), yPos + 1.5);
                    }
                    curX += tok.width + (justify ? spacePerToken : 0);
                } else {
                    // Simulate Styles (Unified Logic below)
                    // Old Bold Block removed to prevent double draw
                    // See Unified Rendering Logic below

                    // Underline
                    if (tok.underline) {
                        doc.setLineWidth(0.3);
                        doc.line(curX, yPos + 1.5, curX + tok.width, yPos + 1.5); // Lowered slightly
                    }

                    // Unified Rendering Logic
                    const skewFactor = 0.3;

                    // 1. Italic (Complex handling with Matrix)
                    if (tok.italic) {
                        // Compensation: we want visual x = curX. x' = x - skewFactor * y.
                        const adjustedX = curX + (skewFactor * yPos);
                        try {
                            // @ts-ignore
                            const MatrixConstructor = (doc as any).Matrix || (jsPDF as any).Matrix || (doc.internal as any).Matrix;
                            if (MatrixConstructor) {
                                const mtx = new MatrixConstructor(1, 0, -skewFactor, 1, 0, 0);
                                if (tok.bold) {
                                    doc.text(tok.text, adjustedX + 0.15, yPos, { transform: mtx } as any);
                                    doc.text(tok.text, adjustedX, yPos, { transform: mtx } as any);
                                } else {
                                    doc.text(tok.text, adjustedX, yPos, { transform: mtx } as any);
                                }
                            } else {
                                // Fallback
                                if (tok.bold) {
                                    doc.text(tok.text, curX + 0.15, yPos);
                                    doc.text(tok.text, curX, yPos);
                                } else {
                                    doc.text(tok.text, curX, yPos);
                                }
                            }
                        } catch (e) {
                            // Fallback
                            if (tok.bold) {
                                doc.text(tok.text, curX + 0.15, yPos);
                                doc.text(tok.text, curX, yPos);
                            } else {
                                doc.text(tok.text, curX, yPos);
                            }
                        }
                    }
                    // 2. Bold (Upright)
                    else if (tok.bold) {
                        doc.setLineWidth(0.2);
                        doc.text(tok.text, curX, yPos);
                        doc.text(tok.text, curX + 0.1, yPos);
                    }
                    // 3. Normal
                    else {
                        doc.text(tok.text, curX, yPos);
                    }

                    curX += tok.width;
                }
            });

            yPos += 5;
            isFirstLine = false;
        };

        tokens.forEach(tok => {
            const indent = isFirstLine ? firstLineIndent : 0;
            const maxW = lineWidth - indent;

            if (currentLineWidth + tok.width > maxW) {
                printLine(currentLine, true); // Justify
                currentLine = [tok];
                currentLineWidth = tok.width;
            } else {
                currentLine.push(tok);
                currentLineWidth += tok.width;
            }
        });

        if (currentLine.length > 0) {
            printLine(currentLine, false); // Left align last line
        }

        yPos += 3;
    });

    yPos += 15;

    // [NEW] Stamp Logic
    if ((item as any).includeStamp) {
        const company = companies.find(c => c.id === item.companyId);
        if (company && company.stamp) {
            try {
                const imgProps = doc.getImageProperties(company.stamp);
                const stampWidth = 40; // Approx 4cm width
                const stampHeight = (imgProps.height * stampWidth) / imgProps.width;

                // Check page overflow
                if (yPos + stampHeight > 280) {
                    doc.addPage();
                    yPos = 20;
                }

                // x: 130 seems reasonable for right side. yPos is currently TextEnd + 15.
                // User wants 2 lines (~10mm) below text. So yPos - 5.
                doc.addImage(company.stamp, 'PNG', 130, yPos - 5, stampWidth, stampHeight);

                // Advance cursor for next sections (Attachments)
                yPos += stampHeight;
            } catch (e) {
                console.error('Error adding stamp:', e);
            }
        }
    }

    // 7. Attachments (Ekler) - No indent, just List
    if ((item.appendices && item.appendices.length > 0) || (item.attachmentUrls && item.attachmentUrls.length > 0)) {

        // Helper to check page break
        if (yPos > 250) { doc.addPage(); yPos = 20; }

        doc.setFont(fontName, 'bold');
        doc.text('EKLER:', marginLeft, yPos);
        yPos += 5;
        doc.setFont(fontName, 'normal');

        // Text Appendices
        if (item.appendices && item.appendices.length > 0) {
            item.appendices.forEach((app: string, i: number) => {
                if (!app) return;
                const label = `${i + 1}) ${app}`;
                // No extra indent, align with EKLER
                const lines = doc.splitTextToSize(label, contentWidth);

                if (yPos + doc.getTextDimensions(lines).h > 280) { doc.addPage(); yPos = 20; }

                doc.text(lines, marginLeft, yPos);
                yPos += doc.getTextDimensions(lines).h + 2;
            });
        }

        // Start numbering for files based on text appendices count
        const startIdx = (item.appendices?.filter((a: string) => !!a).length || 0);

        // File Appendices
        if (item.attachmentUrls && item.attachmentUrls.length > 0) {
            item.attachmentUrls.forEach((_url: string, i: number) => {
                if (yPos + 5 > 280) { doc.addPage(); yPos = 20; }
                doc.text(`${startIdx + i + 1}) Ek Dosya (PDF)`, marginLeft, yPos);
                yPos += 5;
            });
        }
    }

    if (isPreview) {
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } else {
        doc.save(`${(item.subject || 'dokuman').substring(0, 20)}.pdf`);
    }
};
