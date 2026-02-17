
const myCompanies = [
    { name: "KAD-TEM MÜH. MÜT. İNŞ. OTO. TURZ. TİC. VE SAN. A.Ş.", shortName: "KAD" },
    { name: "İKİKAT İNŞ. TAAH. HAYV. SAN. VE TİC. LTD. ŞTİ.", shortName: "IKI" },
    { name: "ÖZ PEHLİVAN İNŞAAT", shortName: null }
];

const bidders = [
    "ÖZ PEHLİVAN İNŞ., ELEK., HAYVANCILIK, GID., NAKLİYE SAN. VE TİC. LTD. ŞTİ., KADİR DİNÇER KOZAN",
    "KAD-TEM İNŞAAT TAAH.",
    "BİR BAŞKA KAD FİRMASI",
    "KADINLAR DERNEĞİ",
    "İKİKAT İNŞAAT", // Should Match
    "KENAN TUGAY İKİKAT", // Should Match
    "İKİKATI İNŞAAT" // Should NOT Match (Grammatically different word 'Ikikati')
];

const isOwnerCompany = (bidderName) => {
    if (!bidderName) return false;
    const normalizedBidder = bidderName.toLocaleLowerCase('tr');
    return myCompanies.some(c => {
        const cName = c.name.toLocaleLowerCase('tr');
        const cShort = c.shortName?.toLocaleLowerCase('tr');

        // 1. Check full name containment
        if (normalizedBidder.includes(cName)) {
            console.log(`Matched FullName: ${c.name}`);
            return true;
        }

        // 2. Check short name with WORD BOUNDARY
        if (cShort) {
            try {
                const escapedShort = cShort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = `(?<!\\p{L})${escapedShort}(?!\\p{L})`;
                const regex = new RegExp(pattern, 'u');
                if (regex.test(normalizedBidder)) {
                    console.log(`Matched ShortName: ${cShort}`);
                    return true;
                }
            } catch (e) { }
        }

        // 3. PROPOSED: Check First Word of Company Name
        const firstWord = cName.split(' ')[0];
        if (firstWord && firstWord.length > 2) {
            try {
                const escaped = firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = `(?<!\\p{L})${escaped}(?!\\p{L})`;
                const regex = new RegExp(pattern, 'u');
                if (regex.test(normalizedBidder)) {
                    console.log(`Matched FirstWord: ${firstWord}`);
                    return true;
                }
            } catch (e) { }
        }

        return false;
    });
};

console.log("--- Refined Verification Results ---");
bidders.forEach(b => {
    console.log(`Bidder: "${b}" -> Is Owner? ${isOwnerCompany(b)}`);
    console.log('---');
});
