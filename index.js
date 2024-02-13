import { config } from 'dotenv';
import { Client } from 'basic-ftp';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import pkg from 'papaparse';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node'; // Make sure to import the adapter
const { parse } = pkg;

// Load your environment variables
config();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET_KEY = process.env.SHOPIFY_API_SECRET_KEY;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const SHOPIFY_API_SCOPES = process.env.SHOPIFY_API_SCOPES.split(',');
const SHOPIFY_LOCATION_ID = `gid://shopify/Location/${process.env.SHOPIFY_LOCATION_ID}`;

// Initialize your Shopify API client
const shopify = shopifyApi({
    apiKey: SHOPIFY_API_KEY,
    apiSecretKey: SHOPIFY_API_SECRET_KEY,
    scopes: SHOPIFY_API_SCOPES,
    hostName: SHOPIFY_DOMAIN,
    apiVersion: LATEST_API_VERSION, // or specify your version directly, e.g., '2022-01'
});

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;
  

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

const collectionJSON = fs.readFileSync('./collections.json', 'utf8');
const collections = JSON.parse(collectionJSON);

// Function to load collection mappings from JSON file
const collectionMappings = collections.reduce((acc, { title, gid }) => {
    // Assuming the title in collections.json matches the department name exactly
    acc[title] = gid;
    return acc;
}, {});

function mapDepartmentToCollection(departmentNumber, departmentMappings) {

    const departmentNames  = {
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
        "43": "Upper Receivers & Conversion Kits - High Capacity"
    };
    const departmentName = departmentNames[departmentNumber];
    return collectionMappings[departmentName];
}

async function transformAndCreateJSONL(localInventoryPath) {
    const fileContent = fs.readFileSync(localInventoryPath, 'utf8');
    const lines = fileContent.split('\n').map(line => line.split(';'));
    const products = lines.slice(1, 50).map(cols => {
        let product = {};
        cols.forEach((col, index) => {
            product[HEADERS[index]] = col;
        });
        return product;
    });

    const jsonlProducts = products.map(product => {
        const collectionGID = mapDepartmentToCollection(product['Department Number']);
        return {
            input: {
                title: product['Product Description'],
                descriptionHtml: product['Expanded Product Description'],
                vendor: product['Full Manufacturer Name'],
                status: "ACTIVE",
                published: true,
                variants: [{
                    sku: product['RSR Stock Number'],
                    price: product['Retail Price'],
                    inventoryQuantities: [{
                        availableQuantity: parseInt(product['Inventory Quantity'], 10) || 0,
                        locationId: SHOPIFY_LOCATION_ID
                    }],
                    weight: parseFloat(product['Product Weight']) || 0,
                    weightUnit: "OUNCES"
                }],
                collectionsToJoin: [collectionGID], // Assign the GID directly here
            },
            media: [{
                originalSource: `https://img.rsrgroup.com/pimages/${product['RSR Stock Number']}_1.jpg`,
                alt: `${product['Product Description']} product image`,
                mediaContentType: "IMAGE"
            }],
        };
    });

    const jsonlContent = jsonlProducts.map(p => JSON.stringify(p)).join('\n');
    fs.writeFileSync('./products.jsonl', jsonlContent);
    console.log('JSONL file for Shopify created successfully.');
}

async function uploadJSONLtoShopify(jsonlFilePath) {
    const graphqlEndpoint = `https://${SHOPIFY_DOMAIN}/admin/api/${LATEST_API_VERSION}/graphql.json`;
    const headers = {
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        'Content-Type': 'application/json',
    };

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
        if (data.data.stagedUploadsCreate.userErrors.length > 0) {
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
        if (userErrors.length > 0) {
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

// Polling function
async function pollBulkOperationStatus(operationId, graphqlEndpoint, headers) {
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
        console.log(`Current operation status: ${operationStatus}`);

        if (operationStatus === 'COMPLETED' || operationStatus === 'FAILED') {
            operationInProgress = false;
            console.log(`Operation finished with status: ${operationStatus}`);
            if (operationStatus === 'COMPLETED') {
                console.log(`Results available at: ${data.data.node.url}`);
            } else if (data.data.node.partialDataUrl) {
                console.log(`Partial results available at: ${data.data.node.partialDataUrl}`);
            }
        } else {
            // Wait for a period before polling again
            console.log('Operation in progress. Waiting before next status check...');
            await new Promise(resolve => setTimeout(resolve, 10000)); // Adjust polling interval as needed
        }
    }
}

async function main() {
    const localInventoryPath = './fulfillment-inv-new.txt';
    await downloadFile('/ftpdownloads/fulfillment-inv-new.txt', localInventoryPath);
    transformAndCreateJSONL(localInventoryPath); // Ensure this function creates 'products.jsonl'
    // await uploadJSONLtoShopify('./products.jsonl').catch(console.error);
}

main().catch(console.error);