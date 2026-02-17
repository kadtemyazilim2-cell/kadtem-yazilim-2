
const myCompanies = [
    { name: "KAD-TEM MÜH. MÜT. İNŞ. OTO. TURZ. TİC. VE SAN. A.Ş.", shortName: "KAD" },
    { name: "İKİKAT İNŞ. TAAH. HAYV. SAN. VE TİC. LTD. ŞTİ.", shortName: "IKI" }
];

const bidders = [
    "ÖZ PEHLİVAN İNŞ., ELEK., HAYVANCILIK, GID., NAKLİYE SAN. VE TİC. LTD. ŞTİ., KADİR DİNÇER KOZAN",
    "KAD-TEM İNŞAAT TAAH.",
    "BİR BAŞKA KAD FİRMASI",
    "KADINLAR DERNEĞİ",
    "İKİKAT İNŞAAT"
];

const isOwnerCompany = (bidderName) => {
    if (!bidderName) return false;
    const normalizedBidder = bidderName.toLocaleLowerCase('tr');
    return myCompanies.some(c => {
        const cName = c.name.toLocaleLowerCase('tr');
        const cShort = c.shortName?.toLocaleLowerCase('tr');

        // 1. Check full name containment
        if (normalizedBidder.includes(cName)) return true;

        // 2. Check short name with WORD BOUNDARY (Unicode Aware)
        if (cShort) {
            try {
                const escapedShort = cShort.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const pattern = `(?<!\\p{L})${escapedShort}(?!\\p{L})`;
                const regex = new RegExp(pattern, 'u');
                return regex.test(normalizedBidder);
            } catch (e) {
                return false;
            }
        }
        return false;
    });
};

console.log("--- Verification Results ---");
bidders.forEach(b => {
    console.log(`Bidder: "${b}" -> Is Owner? ${isOwnerCompany(b)}`);
});
