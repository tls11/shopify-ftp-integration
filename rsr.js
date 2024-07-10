import fs from 'fs';

import 'dotenv/config'
import { Client } from 'basic-ftp';

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

export async function downloadRSRftp(remoteFilePath, localFilePath) {
    const client = new Client();
    client.ftp.verbose = true;
    try {
        await client.access({
            host: FTP_HOST,
            port: 2222,
            user: FTP_USER,
            password: FTP_PASSWORD,
            secure: true
        });
        await client.downloadTo(localFilePath, remoteFilePath);
        console.log(`Downloaded ${remoteFilePath} successfully.`);
    } catch (error) {
        console.error(`Failed to download ${remoteFilePath}:`, error);
    } finally {
        client.close();
    }
}

// can be found in rsr_inventory_header_layout.xlsx, RSR_Filezilla_Guide.pdf, and dealers-toolbox/inventory-file-layout
const COL_HEADERS = [
    'RSR Stock Number',
    'UPC Code',
    'Product Description',
    'Department Number',
    'Manufacturer Id',
    'Retail Price',
    'RSR Pricing',
    'Product Weight',
    'Inventory Quantity',
    'Model',
    'Full Manufacturer Name',
    'Manufacturer Part Number',
    'Allocated/Closeout/Deleted',
    'Expanded Product Description',
    'Image Name',
    'AK – Alaska',
    'AL – Alabama',
    'AR – Arkansas',
    'AZ – Arizona',
    'CA – California',
    'CO – Colorado',
    'CT – Connecticut',
    'DC – District of Columbia',
    'DE – Delaware',
    'FL – Florida',
    'GA – Georgia',
    'HI – Hawaii',
    'IA – Iowa',
    'ID – Idaho',
    'IL – Illinois',
    'IN – Indiana',
    'KS – Kansas',
    'KY – Kentucky',
    'LA – Louisiana',
    'MA – Massachusetts',
    'MD – Maryland',
    'ME – Maine',
    'MI – Michigan',
    'MN – Minnesota',
    'MO – Missouri',
    'MS – Mississippi',
    'MT – Montana',
    'NC – North Carolina',
    'ND – North Dakota',
    'NE – Nebraska',
    'NH – New Hampshire',
    'NJ – New Jersey',
    'NM – New Mexico',
    'NV – Nevada',
    'NY – New York',
    'OH – Ohio',
    'OK – Oklahoma',
    'OR – Oregon',
    'PA – Pennsylvania',
    'RI – Rhode Island',
    'SC – South Carolina',
    'SD – South Dakota',
    'TN – Tennessee',
    'TX – Texas',
    'UT – Utah',
    'VA – Virginia',
    'VT – Vermont',
    'WA – Washington',
    'WI – Wisconsin',
    'WV – West Virginia',
    'WY - Wyoming',
    'Ground Shipments Only',
    'Adult Signature Required',
    'Blocked from Drop Ship',
    'Date Entered',
    'Retail MAP',
    'Image Disclaimer',
    'Shipping Length',
    'Shipping Width',
    'Shipping Height',
    'Prop 65',
    'Vendor Approval Required',
    'Reserved for Future Use',
];

export function parseRSRInventory(localRSRInventoryPath) {
    const fileContent = fs.readFileSync(localRSRInventoryPath, 'utf8');
    const lines = fileContent.split('\n').map(line => line.split(';'));
    const products = lines.map(cols => {
        let product = {};
        cols.forEach((col, index) => {
            product[COL_HEADERS[index]] = col;
        });
        return product;
    });
    return products;
}

export const DEPARTMENT_NUMBER_GID_MAP = {
    '01': 'gid://shopify/Collection/468783366430',
    '02': 'gid://shopify/Collection/468783399198',
    '03': 'gid://shopify/Collection/468783431966',
    '04': 'gid://shopify/Collection/468783464734',
    '05': 'gid://shopify/Collection/468783497502',
    '06': 'gid://shopify/Collection/468783530270',
    '07': 'gid://shopify/Collection/468783563038',
    '08': 'gid://shopify/Collection/468783595806',
    '09': 'gid://shopify/Collection/468783628574',
    10: 'gid://shopify/Collection/474256376094',
    11: 'gid://shopify/Collection/468783661342',
    12: 'gid://shopify/Collection/468783694110',
    13: 'gid://shopify/Collection/468783726878',
    14: 'gid://shopify/Collection/468783759646',
    15: 'gid://shopify/Collection/468783792414',
    16: 'gid://shopify/Collection/468783825182',
    17: 'gid://shopify/Collection/468783857950',
    18: 'gid://shopify/Collection/468783890718',
    19: 'gid://shopify/Collection/468783923486',
    20: 'gid://shopify/Collection/474788069662',
    21: 'gid://shopify/Collection/468783989022',
    22: 'gid://shopify/Collection/468784021790',
    23: 'gid://shopify/Collection/468784054558',
    24: 'gid://shopify/Collection/468784087326',
    25: 'gid://shopify/Collection/468784120094',
    26: 'gid://shopify/Collection/468784152862',
    27: 'gid://shopify/Collection/468784185630',
    28: 'gid://shopify/Collection/468784218398',
    29: 'gid://shopify/Collection/468784251166',
    30: 'gid://shopify/Collection/468784283934',
    31: 'gid://shopify/Collection/468783628574',
    32: 'gid://shopify/Collection/468784316702',
    33: 'gid://shopify/Collection/468784349470',
    34: 'gid://shopify/Collection/468784382238',
    35: 'gid://shopify/Collection/468784415006',
    36: 'gid://shopify/Collection/468784447774',
    37: 'gid://shopify/Collection/468784480542',
    38: 'gid://shopify/Collection/468784513310',
    39: 'gid://shopify/Collection/468784546078',
    40: 'gid://shopify/Collection/468784578846',
    41: 'gid://shopify/Collection/468784611614',
    42: 'gid://shopify/Collection/468784644382',
    43: 'gid://shopify/Collection/468784677150',
};
