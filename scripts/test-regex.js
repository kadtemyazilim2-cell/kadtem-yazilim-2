
const short = "KAD";
const bidder = "KADİR DİNÇER KOZAN";
const bidder2 = "KAD-TEM";
const bidder3 = "KAD TEM";
const bidder4 = "ARKADAŞ";

// Using Unicode Lookarounds
const regex = new RegExp(`(?<!\\p{L})${short}(?!\\p{L})`, 'gui'); // g, u, i flags

console.log(`Regex: ${regex}`);

console.log(`Testing '${bidder}':`, regex.test(bidder)); // Should be false
console.log(`Testing '${bidder2}':`, regex.test(bidder2)); // Should be true
console.log(`Testing '${bidder3}':`, regex.test(bidder3)); // Should be true
console.log(`Testing '${bidder4}':`, regex.test(bidder4)); // Should be false
