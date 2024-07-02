import 'dotenv/config'
import { Client } from 'basic-ftp';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import pkg from 'papaparse';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node'; // Make sure to import the adapter
import { Stream } from 'stream';
import { promisify } from 'util';
const { parse } = pkg;
const pipeline = promisify(Stream.pipeline);

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET_KEY = process.env.SHOPIFY_API_SECRET_KEY;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME;
const SHOPIFY_API_SCOPES = process.env.SHOPIFY_API_SCOPES.split(',');
const SHOPIFY_LOCATION_ID = `gid://shopify/Location/${process.env.SHOPIFY_LOCATION_ID}`;

// Initialize your Shopify API client
// ? doesn't look like this is being used
const shopify = shopifyApi({
    apiKey: SHOPIFY_API_KEY,
    apiSecretKey: SHOPIFY_API_SECRET_KEY,
    scopes: SHOPIFY_API_SCOPES,
    hostName: SHOPIFY_STORE_NAME,
    apiVersion: LATEST_API_VERSION,
});

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

const graphqlEndpoint = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-07/graphql.json`;
const headers = {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
};

// can be found in rsr_inventory_header_layout.xlsx, RSR_Filezilla_Guide.pdf, and dealers-toolbox/inventory-file-layout
const COL_HEADERS = [
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
    "Prop 65",
    "Vendor Approval Required",
    "Reserved for Future Use",
];

async function downloadFileFTP(remoteFilePath, localFilePath) { // * '/ftpdownloads/fulfillment-inv-new.txt', localInventoryPath [./fulfillment-inv-new.txt]
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

// ! import and run code from collections.js
const collectionJSON = fs.readFileSync('./collections.json', 'utf8');
const collections = JSON.parse(collectionJSON);

// map department name to shopify gid
const collectionMap = collections.reduce((acc, { title, gid }) => {
    acc[title] = gid;
    return acc;
}, {});

function mapDepartmentToCollectionGID(departmentNumber, departmentMappings) {
    // found in dealers-toolbox/inventory-file-layout
    const departmentNames = {
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
        "37": "Unused",
        "38": "Books, Software & DVD's",
        "39": "Targets",
        "40": "Hard Gun Cases",
        "41": "Upper Receivers & Conversion Kits",
        "42": "SBR Barrels & Upper Receivers",
        "43": "Upper Receivers & Conversion Kits - High Capacity",
    };
    const departmentName = departmentNames[departmentNumber];
    return collectionMap[departmentName];
}

async function readShopifyInventoryDetailed() {
    const shopifyInventoryPath = './shopify_inventory.jsonl';
    const inventoryDetails = new Map(); // Map SKU to detailed inventory info

    if (fs.existsSync(shopifyInventoryPath)) {
        const inventoryData = fs.readFileSync(shopifyInventoryPath, 'utf8').split('\n');
        for (let line of inventoryData) {
            if (line) { // ? not sure why this is needed
                const data = JSON.parse(line);
                if (data.sku && data.inventoryQuantity !== undefined) {
                    inventoryDetails.set(data.sku, {
                        quantity: data.inventoryQuantity,
                        productId: data.__parentId, // main product - parent of variant
                        inventoryItemId: data.inventoryItem.id //  unique identifier for each inventory item
                    });
                }
            }
        }
    }
    return inventoryDetails;
}

// This function should be adapted to match your product structure for Shopify
function prepareNewProductData(product) {
    const collectionGID = mapDepartmentToCollectionGID(product['Department Number']);
    return {
        input: {
            title: product['Product Description'],
            descriptionHtml: product['Expanded Product Description'],
            vendor: product['Full Manufacturer Name'],
            status: "ACTIVE",
            // variants: [{ // ! 'Invalid Bulk Mutation Field - Variable $input of type ProductInput! was provided invalid value for variants (Field is not defined on ProductInput)'
            //     sku: product['RSR Stock Number'],
            //     price: product['Retail Price'],
            //     inventoryItem: {
            //         cost: 0, // Update as needed
            //         tracked: true,
            //     },
            //     inventoryQuantities: [{
            //         availableQuantity: parseInt(product['Inventory Quantity'], 10) || 0,
            //         locationId: SHOPIFY_LOCATION_ID
            //     }],
            //     weight: parseFloat(product['Product Weight']) || 0,
            //     weightUnit: "OUNCES"
            // }],
            collectionsToJoin: [collectionGID],
        },
        media: [{
            originalSource: `https://img.rsrgroup.com/pimages/${product['RSR Stock Number']}_1.jpg`,
            alt: `${product['Product Description']} product image`,
            mediaContentType: "IMAGE"
        }],
    };
}

async function transformAndCreateJSONL(localInventoryPath) { // * right now ['./fulfillment-inv-new.txt']
    const fileContent = fs.readFileSync(localInventoryPath, 'utf8');
    const lines = fileContent.split('\n').map(line => line.split(';'));
    const products = lines.map(cols => {
        let product = {};
        cols.forEach((col, index) => {
            product[COL_HEADERS[index]] = col;
        });
        return product;
    });

    const existingInventoryDetails = await readShopifyInventoryDetailed(); // Detailed inventory info including quantities
    const newProducts = [];
    const updatedProducts = [];

    for (let product of products) {
        const sku = product['RSR Stock Number'];
        const newQuantity = parseInt(product['Inventory Quantity'], 10) || 0;

        if (!existingInventoryDetails.has(sku)) {
            // Handle new product
            const productData = prepareNewProductData(product);
            newProducts.push(productData);
        } else {
            // Existing product, check if inventory update is needed
            const details = existingInventoryDetails.get(sku);
            if (details.quantity !== newQuantity) {
                // Prepare update data for existing product
                const updatedProductData = {
                    productId: details.productId, // Assuming you have the productId
                    input: {
                        id: details.productId,
                        // variants: [{ // ! 'Invalid Bulk Mutation Field - Variable $input of type ProductInput! was provided invalid value for variants (Field is not defined on ProductInput)'
                        //     id: details.inventoryItemId,
                        //     inventoryQuantities: [{
                        //         availableQuantity: newQuantity,
                        //         locationId: SHOPIFY_LOCATION_ID
                        //     }]
                        // }]
                    }
                };
                updatedProducts.push(updatedProductData);
            }
        }
    }

    if (newProducts.length) {
        const newProductsJsonlContent = newProducts.map(p => JSON.stringify(p)).join('\n');
        fs.writeFileSync('./new_products.jsonl', newProductsJsonlContent);
        console.log(`${newProducts.length} new products filtered for creation.`);
    }

    if (updatedProducts.length) {
        const updatedProductsJsonlContent = updatedProducts.map(p => JSON.stringify(p)).join('\n');
        fs.writeFileSync('./updated_products.jsonl', updatedProductsJsonlContent);
        console.log(`${updatedProducts.length} products filtered for inventory update.`);
    }
}


async function uploadJSONLtoShopify(jsonlFilePath) {

    // Prepare the mutation for creating staged upload
    const mutation = `
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
            stagedUploadsCreate(input: $input) {
                stagedTargets {
                    url
                    parameters {
                        name
                        value
                    }
                    resourceUrl
                }
                userErrors {
                    field
                    message
                }
            }
        }`;

    // Variables for the mutation
    const variables = {
        input: [{
            resource: "BULK_MUTATION_VARIABLES",
            filename: "products.jsonl",
            mimeType: "text/jsonl",
            httpMethod: "POST",
        }],
    };

    try {
        // Request Shopify for URL and parameters for the file upload
        const { data } = await axios.post(graphqlEndpoint, {
            query: mutation,
            variables: variables,
        }, { headers });

        // Check for user errors
        if (data.data.stagedUploadsCreate.userErrors.length) {
            console.error('Error creating staged upload:', data.data.stagedUploadsCreate.userErrors);
            return;
        }

        const uploadDetails = data.data.stagedUploadsCreate.stagedTargets[0];
        const uploadUrl = uploadDetails.url;
        const params = uploadDetails.parameters.reduce((acc, { name, value }) => ({ ...acc, [name]: value }), {});
        const resourceUrl = uploadDetails.resourceUrl;

        // Prepare and send the file upload request
        const formData = new FormData();
        Object.keys(params).forEach(key => formData.append(key, params[key]));
        formData.append('file', fs.createReadStream(jsonlFilePath), 'products.jsonl');

        await axios.post(uploadUrl, formData, {
            headers: formData.getHeaders(),
        });

        console.log('File uploaded successfully.');

        // Extract the Key value for stagedUploadPath
        const stagedUploadPath = params['key']; // Using the 'key' parameter as stagedUploadPath

        // Initiate the bulk operation using the Key value
        const bulkOperationMutation = `
            mutation {
                bulkOperationRunMutation(
                    mutation: "mutation($input: ProductInput!, $media: [CreateMediaInput!]) { productCreate(input: $input, media: $media) { product { id } userErrors { field message } } }",
                    stagedUploadPath: "${stagedUploadPath}"
                ) {
                    bulkOperation {
                        id
                        status
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }`;

        const bulkOperationResponse = await axios.post(graphqlEndpoint, {
            query: bulkOperationMutation,
        }, { headers });

        console.log('Bulk operation initiated:', bulkOperationResponse.data);

        const userErrors = bulkOperationResponse.data.data.bulkOperationRunMutation.userErrors;
        if (userErrors.length) {
            console.log('User errors:', userErrors);
        } else {
            console.log('No user errors');
        }

        // If the bulk operation was initiated successfully, start polling for its completion status
        if (bulkOperationResponse.data.data.bulkOperationRunMutation.bulkOperation) {
            const operationId = bulkOperationResponse.data.data.bulkOperationRunMutation.bulkOperation.id;
            await pollBulkOperationStatus(operationId, graphqlEndpoint, headers);
        }
        // Implement polling here to check the status of the bulk operation
    } catch (error) {
        console.error('Failed to upload JSONL to Shopify:', error.message);
    }
}

async function initiateProductFetchBulkOperation() {
    const query = `
        {
            products {
                edges {
                    node {
                        id
                        variants(first: 250) {
                            edges {
                                node {
                                    sku
                                    inventoryQuantity
                                    inventoryItem {
                                        id
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;

    const bulkOperationQuery = `
        mutation {
            bulkOperationRunQuery(
                query: """${query}"""
            ) {
                bulkOperation {
                    id
                    status
                }
                userErrors {
                    field
                    message
                }
            }
        }`;

    try {
        const response = await axios.post(graphqlEndpoint, JSON.stringify({ query: bulkOperationQuery }), { headers });
        const bulkOperation = response.data.data.bulkOperationRunQuery.bulkOperation;
        console.log(`Bulk operation initiated with ID: ${bulkOperation.id}, status: ${bulkOperation.status}`);
        return bulkOperation.id;
    } catch (error) {
        console.error('Failed to initiate bulk fetch operation:', error.message);
    }
}

async function downloadResults(url, outputPath) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
        });
        await pipeline(response.data, fs.createWriteStream(outputPath));
    } catch (error) {
        console.error(`Failed to download file: ${error.message}`);
    }
}

async function pollBulkOperationStatus(operationId, graphqlEndpoint, headers, shouldDownload = false) {
    let operationInProgress = true;
    console.log(`Polling status of operation: ${operationId}`);

    while (operationInProgress) {
        const { data } = await axios.post(graphqlEndpoint, {
            query: `
                query {
                    node(id: "${operationId}") {
                        ... on BulkOperation {
                            id
                            status
                            errorCode
                            createdAt
                            completedAt
                            objectCount
                            fileSize
                            url
                            partialDataUrl
                        }
                    }
                }
            `,
        }, { headers });

        const operationStatus = data.data.node.status;
        const objectCount = data.data.node.objectCount;
        console.log(`Current operation status: ${operationStatus}`);
        console.log(`operations completed: ${objectCount}`);

        if (operationStatus === 'COMPLETED' || operationStatus === 'FAILED') {
            operationInProgress = false;
            console.log(`Operation finished with status: ${operationStatus}`);

            // Log the URL regardless of shouldDownload
            if (operationStatus === 'COMPLETED') {
                console.log(`Results available at: ${data.data.node.url}`);
                if (shouldDownload && data.data.node.url) {
                    console.log(`Downloading results from: ${data.data.node.url}`);
                    await downloadResults(data.data.node.url, './shopify_inventory.jsonl');
                    console.log(`Results saved to shopify_inventory.jsonl`);
                }
                else if (shouldDownload && data.data.node.partialDataUrl === null) {
                    // create empty shopify_inventory.jsonl
                    fs.writeFileSync('./shopify_inventory.jsonl', '');
                    console.log('No results available to download');
                }
            }

            if (data.data.node.partialDataUrl) {
                console.log(`Partial results available at: ${data.data.node.partialDataUrl}`);
            }
        } else {
            // Wait for a period before polling again
            console.log('Operation in progress. Waiting before next status check...');
            await new Promise(resolve => setTimeout(resolve, 25000)); // Adjust polling interval as needed
        }
    }
}


async function main() {
    // const localInventoryPath = './fulfillment-inv-new.txt';
    // await downloadFileFTP('/ftpdownloads/fulfillment-inv-new.txt', localInventoryPath); // rsr dropship inventory
    // const bulkOperationId = await initiateProductFetchBulkOperation();
    // await pollBulkOperationStatus(bulkOperationId, graphqlEndpoint, headers, true);

    transformAndCreateJSONL(localInventoryPath);
    await uploadJSONLtoShopify('./new_products.jsonl').catch(console.error);
    await uploadJSONLtoShopify('./updated_products.jsonl').catch(console.error);
}

main().catch(console.error);
