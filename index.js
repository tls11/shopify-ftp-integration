import { configDotenv } from 'dotenv';
import { Client } from 'basic-ftp';
import { createReadStream } from 'fs';
import csv from 'csv-parser';
import ShopifyAPI  from '@shopify/shopify-api';

const Shopify = ShopifyAPI.Shopify;
const DataType = ShopifyAPI.DataType;

// Initialize Shopify API
Shopify.Context.initialize({
    API_KEY: process.env.SHOPIFY_API_KEY,
    API_SECRET_KEY: process.env.SHOPIFY_API_PASSWORD,
    SCOPES: ['write_products', 'read_products'],
    HOST_NAME: process.env.SHOPIFY_DOMAIN.replace(/^https?:\/\//, ''),
    IS_EMBEDDED_APP: false,
    API_VERSION: '2023-04'
});

async function downloadFile(remoteFilePath, localFilePath) {
    const client = new Client();
    client.ftp.verbose = true;

    try {
        await client.access({
            host: process.env.FTP_HOST,
            port: 2222,
            user: process.env.FTP_USER,
            password: process.env.FTP_PASSWORD,
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

async function parseLayoutFile(filePath) {
    const layout = {};
    return new Promise((resolve, reject) => {
        createReadStream(filePath)
            .pipe(csv({ separator: ';' }))
            .on('data', (data) => {
                Object.keys(data).forEach((key) => {
                    layout[key.trim()] = data[key].trim();
                });
            })
            .on('end', () => resolve(layout))
            .on('error', reject);
    });
}

async function updateShopifyWithInventory(inventoryFilePath, layout) {
    createReadStream(inventoryFilePath)
        .pipe(csv({ separator: ';' })) 
        .on('data', async (row) => {
            const productData = mapRowToProductData(row, layout);
            
        })
        .on('end', () => {
            console.log('Inventory update process completed.');
        });
}

function mapRowToProductData(row, layout) {
    
    return {
        title: row[layout['Product Title']],
        body_html: row[layout['Description']],
        variants: [{
            price: row[layout['Price']],
            sku: row[layout['SKU']],
            inventory_quantity: parseInt(row[layout['Quantity']], 10)
        }],
    };
}

async function main() {
    const inventoryFilePath = '/ftpdownloads/fulfillment-inv-new.txt';
    const layoutFilePath = '/ftpdownloads/rsr_inventory_file_layout-new.txt';
    const localInventoryPath = './fulfillment-inv-new.txt';
    const localLayoutPath = './rsr_inventory_file_layout-new.txt';

    await downloadFile(inventoryFilePath, localInventoryPath);
    await downloadFile(layoutFilePath, localLayoutPath);

    const layout = await parseLayoutFile(localLayoutPath);
    await updateShopifyWithInventory(localInventoryPath, layout);
}

main().catch(console.error);
