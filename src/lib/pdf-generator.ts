
import { jsPDF } from 'jspdf';
import { addTurkishFont } from '@/lib/pdf-font';
import { format } from 'date-fns';
import { IKIKAT_LOGO_BASE64, KADTEM_LOGO_BASE64 } from '@/lib/logos';

export const generateCorrespondencePDF = async (item: any, companies: any[], users: any[], isPreview = false) => {
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

    let logoToUse: string | null | undefined = null;

    // [FIX] letterhead ve logoUrl artık store'da yok (PERF: base64 hariç tutuldu).
    // İhtiyaç duyulduğunda getCompanyFull ile çekiyoruz.
    if (company) {
        try {
            const { getCompanyFull } = await import('@/actions/company');
            const fullResult = await getCompanyFull(company.id);
            if (fullResult.success && fullResult.data) {
                logoToUse = fullResult.data.letterhead || fullResult.data.logoUrl || null;
            }
        } catch (e) {
            console.error('Error fetching company letterhead:', e);
        }
    }

    if (logoToUse) {
        try {
            const imgProps = doc.getImageProperties(logoToUse);
            const pdfWidth = 160; // Slightly smaller to fit margins
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            doc.addImage(logoToUse, 'PNG', marginLeft, 10, pdfWidth, pdfHeight);
            yPos = 10 + pdfHeight + 6; // 3mm gap + Line + 3mm gap
        } catch (e) {
            console.error("Error adding logo", e);
            yPos = 44;
        }
    } else {
        // [NEW] Text Header Fallback
        if (company) {
            // If no logo, print Company Name and Details as a text header
            doc.setFont(fontName, 'bold');
            doc.setFontSize(22);
            doc.setTextColor(0, 0, 0); // Standard Black

            doc.text(companyName.toUpperCase(), 105, 30, { align: 'center' });

            yPos = 44; // Default start if no contact info

            // Optional: Address/Phone below header
            doc.setFont(fontName, 'normal');
            doc.setFontSize(8);
            const contactInfo = [
                company.address,
                company.phone,
                company.taxNumber ? `Vergi No: ${company.taxNumber}` : ''
            ].filter(Boolean).join(' - ');

            if (contactInfo) {
                doc.text(contactInfo, 105, 37, { align: 'center' });
                yPos = 44; // Adjusted for 3mm spacing
            }
        } else {
            yPos = 36; // Adjusted for 3mm spacing
        }
    }


    // [NEW] Gray Separator Line
    doc.setDrawColor(200, 200, 200); // Light Gray
    doc.setLineWidth(0.1); // Thin
    doc.line(marginLeft, yPos - 5, 210 - marginRight, yPos - 5); // Raised 2mm (yPos-3 -> yPos-5)
    doc.setDrawColor(0, 0, 0); // Reset to Black

    // 2. Date (Right Aligned)
    // Use item.date or current date if missing? handlePrint uses item.date.
    const dateStr = item.date ? format(new Date(item.date), 'dd.MM.yyyy') : format(new Date(), 'dd.MM.yyyy');
    doc.setFontSize(10);
    doc.setFont(fontName, 'normal');
    // Move Date up even more? User said "sayı ve konuyu 1 satır yukarı alalım"
    // Let's tighten the gap between Date and Number
    doc.text(dateStr, 210 - marginRight, yPos, { align: 'right' });
    yPos += 6; // Reduced spacing (10 -> 6)

    // 3. Number (Sayı)
    doc.setFont(fontName, 'bold');
    doc.setFontSize(10);
    doc.text('Sayı:', marginLeft, yPos);
    doc.setFont(fontName, 'normal');
    doc.text(item.referenceNumber || '-', marginLeft + 12, yPos);
    yPos += 6; // Reduced gap from 8 to 6 (Compact)


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
    doc.setFontSize(11);
    // Increase boldness/visibility by setting line width and rendering as stroke/fill
    doc.setLineWidth(0.4); // Strock effect for extra bold
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    // Toggle rendering mode to Fill + Stroke (2) or just Fill (0) usually. 
    // jsPDF text options: { renderingMode: 'fillThenStroke' } isn't always standard in this version.
    // We can simulate by drawing twice with slight offset or just setting font weight if valid.
    // Let's use the line width trick if we use stroke(), but doc.text() usually fills. 
    // Best way in jsPDF for "Extra Bold":
    // doc.text(..., { renderingMode: 'fillThenStroke' });

    const recipientText = (item.senderReceiver || '');

    // [FIX] Force Bold Rendering for Recipient
    // [FIX] Slight Bold for Recipient (LineWidth 0.1)
    doc.setFont(fontName, 'bold');
    doc.setLineWidth(0.1);
    doc.setDrawColor(0, 0, 0);
    doc.setTextColor(0, 0, 0);

    const recipientLines = doc.splitTextToSize(recipientText, contentWidth);

    // Calculate line height in mm (approximate for layout)
    const lineHeightPt = doc.getFontSize() * 1.15;
    const lineHeightMm = lineHeightPt * 0.352778;
    const renderMode: any = 'fillThenStroke';

    if (recipientLines.length > 1) {
        for (let i = 0; i < recipientLines.length - 1; i++) {
            doc.text(recipientLines[i], 105, yPos, { align: 'center', renderingMode: renderMode });
            yPos += lineHeightMm;
        }
        const prevLine = recipientLines[recipientLines.length - 2];
        const prevLineWidth = doc.getTextWidth(prevLine);
        const prevLineEndX = 105 + (prevLineWidth / 2);
        const lastLine = recipientLines[recipientLines.length - 1];
        doc.text(lastLine, prevLineEndX, yPos, { align: 'center', renderingMode: renderMode });
        yPos += lineHeightMm;
    } else {
        doc.text(recipientLines, 105, yPos, { align: 'center', renderingMode: renderMode });
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
                else if (tag.includes('</i>') || tag.includes('</em>')) { inItalic = false; }
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
                    // [FIX] Cap extra space per word to prevent over-stretching on short lines
                    const maxExtraPerSpace = 3; // mm
                    if (spacePerToken > maxExtraPerSpace) {
                        spacePerToken = 0; // Don't justify if it would look unnatural
                    }
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

                    // 1. Italic (using direct PDF stream cm operator for skew transform)
                    if (tok.italic) {
                        const skewAngle = 12; // degrees - standard italic angle
                        const skewTan = Math.tan(skewAngle * Math.PI / 180);
                        // PDF coordinate system: convert mm to pt (1mm = 72/25.4 pt)
                        const ptFactor = 72 / 25.4;
                        const xPt = curX * ptFactor;
                        const yPt = (297 - yPos) * ptFactor; // A4 height 297mm, PDF origin is bottom-left

                        // Save graphics state, apply skew, draw text, restore
                        // @ts-ignore - jsPDF internal API, type defs incomplete
                        doc.internal.write('q'); // Save state
                        // Transformation matrix: [1 0 tan(angle) 1 tx ty]
                        // We translate to origin, skew, translate back
                        // @ts-ignore
                        doc.internal.write(`1 0 ${skewTan.toFixed(4)} 1 ${(-skewTan * yPt).toFixed(2)} 0 cm`);

                        if (tok.bold) {
                            doc.text(tok.text, curX + 0.1, yPos);
                            doc.text(tok.text, curX, yPos);
                        } else {
                            doc.text(tok.text, curX, yPos);
                        }

                        // @ts-ignore
                        doc.internal.write('Q'); // Restore state
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



    // Stamp Logic - stamp artık companies array'inde yok, ihtiyaç halinde çekiyoruz
    if ((item as any).includeStamp) {
        const company = companies.find(c => c.id === item.companyId);
        if (company) {
            try {
                // [PERF] stamp'ı sadece ihtiyaç duyulduğunda çek
                const { getCompanyFull } = await import('@/actions/company');
                const fullResult = await getCompanyFull(company.id);
                const stampData = fullResult.success && fullResult.data ? fullResult.data.stamp : null;

                if (stampData) {
                    const imgProps = doc.getImageProperties(stampData);
                    const stampWidth = 40; // Approx 4cm width
                    const stampHeight = (imgProps.height * stampWidth) / imgProps.width;

                    // Check page overflow
                    if (yPos + stampHeight > 280) {
                        doc.addPage();
                        yPos = 20;
                    }

                    doc.addImage(stampData, 'PNG', 130, yPos - 5, stampWidth, stampHeight);
                    yPos += stampHeight;
                }
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

// [NEW] Fuel Consumption Report PDF
import autoTable from 'jspdf-autotable';

export const generateFuelConsumptionPDF = (data: any[], dateRange: { start: string, end: string }, siteName: string) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    addTurkishFont(doc);
    const fontName = 'Roboto';
    doc.setFont(fontName, 'normal');

    // Header
    doc.setFontSize(14);
    doc.text('Yakıt Tüketim Raporu', 14, 15);

    doc.setFontSize(10);
    doc.text(`Tarih: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, 280, 15, { align: 'right' });

    let subTitle = `Şantiye: ${siteName || 'Tümü'}`;
    if (dateRange.start || dateRange.end) {
        subTitle += ` | Tarih Aralığı: ${dateRange.start ? format(new Date(dateRange.start), 'dd.MM.yyyy') : 'Başlangıç'} - ${dateRange.end ? format(new Date(dateRange.end), 'dd.MM.yyyy') : 'Bitiş'}`;
    }
    doc.text(subTitle, 14, 22);

    // Table Columns
    const head = [['Tarih', 'Plaka/Araç', 'Sayaç', 'Fark', 'Alınan (Lt)', 'Ort. Tük.', 'Kümülatif', 'Not', 'Veren']];

    // Table Body
    const body = data.map((row: any) => {
        let dateStr = row.recordType === 'BALANCE_START' ? format(new Date(row.date), 'dd.MM.yyyy') : format(new Date(row.date), 'dd.MM.yyyy HH:mm');

        let plate = row.vehicle.plate;
        if (row.recordType === 'VIRMAN_OUT') plate = `Çıkış: ${row.vehicle.plate} -> ${row.targetName || '-'}`;
        if (row.recordType === 'VIRMAN_IN') plate = `Giriş: ${row.vehicle.plate} <- ${row.sourceName || '-'}`;
        if (row.recordType === 'PURCHASE') plate = `Satın Alma: ${row.vehicle.plate}`;
        if (row.recordType === 'BALANCE_START') plate = 'Devreden Stok';

        const unit = row.vehicle?.meterType === 'HOURS' ? ' Sa' : ' Km';
        let meter = (row.recordType === 'LOG' && row.mileage) ? `${row.mileage.toLocaleString()}${unit}` : '-';
        let diff = (row.recordType === 'LOG' && row.diffKm > 0) ? `+${row.diffKm}` : '-';

        let liters = '';
        if (row.recordType === 'LOG') liters = `-${row.liters.toLocaleString()} Lt`;
        else if (row.recordType === 'PURCHASE' || row.recordType === 'VIRMAN_IN') liters = `+${row.liters.toLocaleString()} Lt`; // Abs removed, already positive usually
        else if (row.recordType === 'VIRMAN_OUT') liters = `-${Math.abs(row.liters).toLocaleString()} Lt`;
        else if (row.recordType === 'BALANCE_START') liters = `${row.cumulativeTotal?.toLocaleString()} Lt`; // Show Balance in Liters col? No, usually in Cumulative.

        // Fix for Balance Start: It shouldn't have Alınan Litre, only Cumulative. 
        if (row.recordType === 'BALANCE_START') liters = '-';

        let cons = (row.consumption && row.consumption > 0) ? `${row.consumption.toFixed(2)}` : '-';
        let cumulative = row.cumulativeTotal ? `${row.cumulativeTotal.toLocaleString()} Lt` : '-';

        let filledBy = row.sourceName || '-';
        // Logic for filledBy fallback
        // ...

        return [
            dateStr,
            plate,
            meter,
            diff,
            liters,
            cons,
            cumulative,
            row.description || '',
            filledBy
        ];
    });

    autoTable(doc, {
        startY: 30,
        head: head,
        body: body,
        theme: 'grid',
        styles: {
            font: fontName,
            fontSize: 8,
            cellPadding: 2
        },
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontStyle: 'bold'
        },
        columnStyles: {
            0: { cellWidth: 25 }, // Date
            1: { cellWidth: 50 }, // Plate
            2: { cellWidth: 20 }, // Meter
            3: { cellWidth: 15 }, // Diff
            4: { cellWidth: 25 }, // Liters
            5: { cellWidth: 15 }, // Cons
            6: { cellWidth: 25 }, // Cumulative
            7: { cellWidth: 'auto' }, // Note
            8: { cellWidth: 25 }  // Veren
        }
    });

    doc.save(`yakit_tuketim_raporu_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
};
