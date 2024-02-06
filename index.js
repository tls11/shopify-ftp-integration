import { config } from 'dotenv';
import { Client } from 'basic-ftp';
import fs from 'fs';
import pkg from 'papaparse';
const { parse } = pkg;
import {createAdminApiClient} from '@shopify/admin-api-client';
config();

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

const adminClient = createAdminApiClient({
    storeDomain: process.env.SHOPIFY_DOMAIN,
    apiVersion: '2023-04',
    accessToken: process.env.SHOPIFY_ACCESS_TOKEN,
});
  

const HEADERS = [
    "RSR Stock Number",
    "UPC Code",
    "Product Description",
    "Department Number",
    "Manufacturer Id",
    "Retail Price",
    "RSR Pricing",
    "Product Weight",
    "Inventory Quantity",
    "Model",
    "Full Manufacturer Name",
    "Manufacturer Part Number",
    "Allocated/Closeout/Deleted",
    "Expanded Product Description",
    "Image name",
    "AK – Alaska",
    "AL – Alabama",
    "AR – Arkansas",
    "AZ – Arizona",
    "CA – California",
    "CO – Colorado",
    "CT – Connecticut",
    "DC – District of Columbia",
    "DE – Delaware",
    "FL – Florida",
    "GA – Georgia",
    "HI – Hawaii",
    "IA – Iowa",
    "ID – Idaho",
    "IL – Illinois",
    "IN – Indiana",
    "KS – Kansas",
    "KY – Kentucky",
    "LA – Louisiana",
    "MA – Massachusetts",
    "MD – Maryland",
    "ME – Maine",
    "MI – Michigan",
    "MN – Minnesota",
    "MO – Missouri",
    "MS – Mississippi",
    "MT – Montana",
    "NC – North Carolina",
    "ND – North Dakota",
    "NE – Nebraska",
    "NH – New Hampshire",
    "NJ – New Jersey",
    "NM – New Mexico",
    "NV – Nevada",
    "NY – New York",
    "OH – Ohio",
    "OK – Oklahoma",
    "OR – Oregon",
    "PA – Pennsylvania",
    "RI – Rhode Island",
    "SC – South Carolina",
    "SD – South Dakota",
    "TN – Tennessee",
    "TX – Texas",
    "UT – Utah",
    "VA – Virginia",
    "VT – Vermont",
    "WA – Washington",
    "WI – Wisconsin",
    "WV – West Virginia",
    "WY - Wyoming",
    "Ground Shipments Only",
    "Adult Signature Required",
    "Blocked from Drop Ship",
    "Date Entered",
    "Retail MAP",
    "Image Disclaimer",
    "Shipping Length",
    "Shipping Width",
    "Shipping Height",
    "Prop 65"
];

async function downloadFile(remoteFilePath, localFilePath) {
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


function mapDepartmentToCollection(departmentNumber) {
    const departmentMappings = {
        "1": "Handguns",
        "2": "Used Handguns",
        "3": "Used Long Guns",
        "4": "Tasers",
        "5": "Long Guns",
        "6": "NFA Products",
        "7": "Black Powder",
        "8": "Optics",
        "9": "Optical Accessories",
        "10": "Magazines",
        "11": "Grips, Pads, Stocks, Bipods",
        "12": "Soft Gun Cases, Packs, Bags",
        "13": "Misc. Accessories",
        "14": "Holsters & Pouches",
        "15": "Reloading Equipment",
        "16": "Black Powder Accessories",
        "17": "Closeout Accessories",
        "18": "Ammunition",
        "19": "Survival & Camping Supplies",
        "20": "Lights, Lasers & Batteries",
        "21": "Cleaning Equipment",
        "22": "Airguns",
        "23": "Knives & Tools",
        "24": "High Capacity Magazines",
        "25": "Safes & Security",
        "26": "Safety & Protection",
        "27": "Non-Lethal Defense",
        "28": "Binoculars",
        "29": "Spotting Scopes",
        "30": "Sights",
        "31": "Optical Accessories",
        "32": "Barrels & Choke Tubes",
        "33": "Clothing",
        "34": "Parts",
        "35": "Slings & Swivels",
        "36": "Electronics",
        "38": "Books, Software & DVD's",
        "39": "Targets",
        "40": "Hard Gun Cases",
        "41": "Upper Receivers & Conversion Kits",
        "42": "SBR Barrels & Upper Receivers",
        "43": "Upper Receivers & Conversion Kits - High Capacity"
    };
    return departmentMappings[departmentNumber] || "Uncategorized";
}

function transformAndCreateJSONL(localInventoryPath) {
    const fileContent = fs.readFileSync(localInventoryPath, 'utf8');
    const lines = fileContent.split('\n').map(line => line.split(';'));
    const products = lines.slice(1).map(cols => {
        let product = {};
        cols.forEach((col, index) => {
            product[HEADERS[index]] = col;
        });
        return product;
    });

    const jsonlProducts = products.map(product => ({
        input: {
            title: `${product['Full Manufacturer Name']} ${product['Model']}`,
            vendor: product['Full Manufacturer Name'],
            productType: mapDepartmentToCollection(product['Department Number']),
            variants: [{
                sku: product['RSR Stock Number'],
                price: product['Retail Price'],
                inventoryQuantities: [{
                    availableQuantity: parseInt(product['Inventory Quantity'], 10) || 0,
                }],
                weight: parseFloat(product['Product Weight']) || 0,
                weightUnit: "lb"
            }],
            media: [
                {
                  originalSource: `https://img.rsrgroup.com/pimages/${product['RSR Stock Number']}_1.jpg`,
                  alt: `${product['Full Manufacturer Name']} ${product['Model']} product image`,
                  mediaContentType: "IMAGE"
                },
            ],
            collectionsToJoin: [mapDepartmentToCollection(product['Department Number'])]
        }
    }));

    const jsonlContent = jsonlProducts.map(p => JSON.stringify(p)).join('\n');
    fs.writeFileSync('./products.jsonl', jsonlContent);
    console.log('JSONL file for Shopify created successfully.');
}

async function main() {
    const localInventoryPath = './fulfillment-inv-new.txt';
    await downloadFile('/ftpdownloads/fulfillment-inv-new.txt', localInventoryPath);
    transformAndCreateJSONL(localInventoryPath);
}

main().catch(console.error);