import { config } from 'dotenv';
import { Client } from 'basic-ftp';

config();

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

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
    }

    client.close();
}

async function main() {
    const inventoryFilePath = '/ftpdownloads/fulfillment-inv-new.txt'; 
    const layoutFilePath = '/ftpdownloads/rsr_inventory_file_layout-new.txt'; 

    const localInventoryPath = './fulfillment-inv-new.txt';
    const localLayoutPath = './rsr_inventory_file_layout-new.txt';

    
    await downloadFile(inventoryFilePath, localInventoryPath);
    await downloadFile(layoutFilePath, localLayoutPath);
}

main().catch(console.error);
