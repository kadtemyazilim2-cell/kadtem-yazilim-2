const fs = require('fs');

async function main() {
    try {
        console.log('Fetching AracBelgeListesi.aspx...');
        const response = await fetch('https://ikikat.com.tr/AracBelgeListesi.aspx', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            redirect: 'follow'
        });
        console.log('Final URL:', response.url);
        console.log('Response Status:', response.status);
        const html = await response.text();
        console.log('HTML Preview:', html.substring(0, 500));

        // Check for viewstate in the response
        const viewStateMatch = html.match(/id="__VIEWSTATE" value="(.*?)"/);
        const viewStateGeneratorMatch = html.match(/id="__VIEWSTATEGENERATOR" value="(.*?)"/);
        const eventValidationMatch = html.match(/id="__EVENTVALIDATION" value="(.*?)"/);

        console.log('VIEWSTATE Length:', viewStateMatch ? viewStateMatch[1].length : 'Not Found');

        // Search for forms action
        const formMatch = html.match(/<form[^>]*action="([^"]*)"/);
        console.log('Form Action:', formMatch ? formMatch[1] : 'Not Found');

        // Look for inputs
        const inputs = html.match(/<input[^>]*name="([^"]*)"[^>]*>/g);
        console.log('\nInputs found:');
        if (inputs) {
            inputs.forEach(input => {
                const nameMatch = input.match(/name="([^"]*)"/);
                const idMatch = input.match(/id="([^"]*)"/);
                const typeMatch = input.match(/type="([^"]*)"/);
                console.log(`Name: ${nameMatch?.[1]}, ID: ${idMatch?.[1]}, Type: ${typeMatch?.[1]}`);
            });
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

main();
