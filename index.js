import 'dotenv/config'
import { Client } from 'basic-ftp';
import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Stream } from 'stream';
import { promisify } from 'util';

const pipeline = promisify(Stream.pipeline);

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME;

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASSWORD = process.env.FTP_PASSWORD;

const graphqlEndpoint = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-07/graphql.json`;
const headers = {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
};

// * initialize collection data
async function fetchCollectionByHandle(handle) {
    const query = `
        query collectionByHandle($handle: String!) {
            collectionByHandle(handle: $handle) {
                id
                title
                handle
            }
        }
    `;

    try {
        const { data } = await axios.post(
            graphqlEndpoint, 
            { 
                query: query,
                variables: { handle: handle },
            },
            { headers: headers }
        );
        if (data.data.collectionByHandle) {
            return data.data.collectionByHandle;
        } else {
            console.log(`No collection found with handle "${handle}".`);
            return null;
        }
    } catch (error) {
        console.error(`Failed to fetch collection by handle "${handle}":`, error);
        return null;
    }
}

async function createCollection(title, handle) {
    const mutation = `
        mutation collectionCreate($input: CollectionInput!) {
            collectionCreate(input: $input) {
                collection {
                    id
                    title
                    handle
                }
                userErrors {
                    field
                    message
                }
            }
        }
    `;

    const variables = {
        input: {
            title: title,
            handle: handle,
        },
    };

    try {
        const { data } = await axios.post(
            graphqlEndpoint,
            { query: mutation, variables: variables },
            { headers: headers }
        );
        if (data.data.collectionCreate && data.data.collectionCreate.collection) {
            console.log(`Collection "${title}" created successfully.`);
            return data.data.collectionCreate.collection;
        } else if (data.data.collectionCreate.userErrors.length) {
            console.error('Failed to create collection:', data.data.collectionCreate.userErrors);
            return null;
        }
    } catch (error) {
        console.error(`Failed to create collection "${title}":`, error);
        return null;
    }
}



async function createOrFetchCollections() {
    const collections = [
        { title: "Handguns", handle: "handguns" },
        { title: "Used Handguns", handle: "used-handguns" },
        { title: "Used Long Guns", handle: "used-long-guns" },
        { title: "Tasers", handle: "tasers" },
        { title: "Long Guns", handle: "long-guns" },
        { title: "NFA Products", handle: "nfa-products" },
        { title: "Black Powder", handle: "black-powder" },
        { title: "Optics", handle: "optics" },
        { title: "Optical Accessories", handle: "optical-accessories" },
        { title: "Magazines", handle: "magazines" },
        { title: "Grips, Pads, Stocks, Bipods", handle: "grips-pads-stocks-bipods" },
        { title: "Soft Gun Cases, Packs, Bags", handle: "soft-gun-cases-packs-bags" },
        { title: "Misc. Accessories", handle: "misc-accessories" },
        { title: "Holsters & Pouches", handle: "holsters-pouches" },
        { title: "Reloading Equipment", handle: "reloading-equipment" },
        { title: "Black Powder Accessories", handle: "black-powder-accessories" },
        { title: "Closeout Accessories", handle: "closeout-accessories" },
        { title: "Ammunition", handle: "ammunition" },
        { title: "Survival & Camping Supplies", handle: "survival-camping-supplies" },
        { title: "Lights, Lasers & Batteries", handle: "lights-lasers-batteries" },
        { title: "Cleaning Equipment", handle: "cleaning-equipment" },
        { title: "Airguns", handle: "airguns" },
        { title: "Knives & Tools", handle: "knives-tools" },
        { title: "High Capacity Magazines", handle: "high-capacity-magazines" },
        { title: "Safes & Security", handle: "safes-security" },
        { title: "Safety & Protection", handle: "safety-protection" },
        { title: "Non-Lethal Defense", handle: "non-lethal-defense" },
        { title: "Binoculars", handle: "binoculars" },
        { title: "Spotting Scopes", handle: "spotting-scopes" },
        { title: "Sights", handle: "sights" },
        { title: "Barrels & Choke Tubes", handle: "barrels-choke-tubes" },
        { title: "Clothing", handle: "clothing" },
        { title: "Parts", handle: "parts" },
        { title: "Slings & Swivels", handle: "slings-swivels" },
        { title: "Electronics", handle: "electronics" },
        { title: "Unused", handle: "unused" },
        { title: "Books, Software & DVD's", handle: "books-software-dvds" },
        { title: "Targets", handle: "targets" },
        { title: "Hard Gun Cases", handle: "hard-gun-cases" },
        { title: "Upper Receivers & Conversion Kits", handle: "upper-receivers-conversion-kits" },
        { title: "SBR Barrels & Upper Receivers", handle: "sbr-barrels-upper-receivers" },
        { title: "Upper Receivers & Conversion Kits - High Capacity", handle: "upper-receivers-conversion-kits-high-capacity" },
    ];
    const collectionsData = [];

    for (let { title, handle } of collections) {
        let collection = await fetchCollectionByHandle(handle);
        if (!collection) {
            console.log(`Collection with handle "${handle}" does not exist. Creating.`);
            collection = await createCollection(title, handle);
            if (!collection) continue; // If collection creation failed, skip this iteration
        }

        // TODO: review overall mapping strategy
        // TODO: handle non-standard titles

         // ! ------------
        // "handle": "ammunition",
        // "title": "AMMO",
        
        // "handle": "high-capacity-magazines",
        // "title": "Magazines 5",
        
        // "handle": "sights",
        // "title": "SIGHTS",
        
        // "handle": "clothing",
        // "title": "Belts , Gloves +",

        // "handle": "parts",
        // "title": "PARTS",
        // ! ------------
        const outliers = {  

        };
        // if () {

        // }
        collectionsData.push({
            handle: collection.handle,
            title: collection.title,
            gid: collection.id
        });
    }
    fs.writeFileSync('collections.json', JSON.stringify(collectionsData, null, 2));
    console.log('Collections data has been written to collections.json');
}

await createOrFetchCollections().catch(console.error);

const collectionJSON = fs.readFileSync('./collections.json', 'utf8');
const collections = JSON.parse(collectionJSON);

// map department name to shopify gid
const collectionMap = collections.reduce((acc, { title, gid }) => {
    acc[title] = gid;
    return acc;
}, {});

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

async function downloadFileFTP(remoteFilePath, localFilePath) {
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

function mapDepartmentNumberToCollectionGID(departmentNumber) {
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

function readShopifyInventoryDetails() {
    const shopifyInventoryPath = './shopify_inventory.jsonl';
    const inventoryDetails = new Map(); // Map SKU to detailed inventory info

    if (fs.existsSync(shopifyInventoryPath)) {
        const inventoryData = fs.readFileSync(shopifyInventoryPath, 'utf8').split('\n');
        for (let line of inventoryData) {
            if (line) {
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

function readLineJSONL(filePath, cb) {
    const collection = [];
    if (fs.existsSync(filePath)) {
        const inventoryData = fs.readFileSync(filePath, 'utf8').split('\n');
        for (let line of inventoryData) {
            if (line) {
                const data = JSON.parse(line);
                collection.push(cb(data));
            }
        }
    }
    return collection;
}

function prepareNewProductData(product) {
    const collectionGID = mapDepartmentNumberToCollectionGID(product['Department Number']);
    return {
        input: {
            title: product['Product Description'],
            descriptionHtml: product['Expanded Product Description'],
            vendor: product['Full Manufacturer Name'],
            status: "ACTIVE",
            collectionsToJoin: [collectionGID],
        },
        media: [{
            originalSource: `https://img.rsrgroup.com/pimages/${product['RSR Stock Number']}_1.jpg`,
            alt: `${product['Product Description']} product image`,
            mediaContentType: "IMAGE"
        }],
    };
}

// TODO: make more general so it can be used for all bulk mutations
async function transformAndCreateJSONL(localInventoryPath) {
    const fileContent = fs.readFileSync(localInventoryPath, 'utf8');
    const lines = fileContent.split('\n').map(line => line.split(';'));
    const products = lines.map(cols => {
        let product = {};
        cols.forEach((col, index) => {
            product[COL_HEADERS[index]] = col;
        });
        return product;
    });

    const existingInventoryDetails = await readShopifyInventoryDetails(); // Detailed inventory info including quantities
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
                const delta = (details.quantity - newQuantity) * -1;
                // Prepare update data for existing product
                // TODO: verify expected input for update call
                const updatedProductData = {
                    productId: details.productId,
                    input: {
                        inventoryItemId: details.productId,
                        availableDelta: delta,
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
        return stagedUploadPath = params['key']; // Using the 'key' parameter as stagedUploadPath
    } catch (error) {
        console.error('Failed to upload JSONL to Shopify:', error.message);
    }
}

async function createBulkOperation(stagedUploadPath, query) {
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

    if (bulkOperationResponse.data.data.bulkOperationRunMutation.bulkOperation) {
        const operationId = bulkOperationResponse.data.data.bulkOperationRunMutation.bulkOperation.id;
        return operationId;
    }
}

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
        const objectCount = data.data.node.objectCount;
        console.log(`Current operation status: ${operationStatus}`);
        console.log(`operations completed: ${objectCount}`);

        if (operationStatus === 'COMPLETED' || operationStatus === 'FAILED') {
            operationInProgress = false;
            console.log(`Operation finished with status: ${operationStatus}`);

            if (operationStatus === 'COMPLETED') {
                if (data.data?.node?.url) {
                    console.log(`Results available at: ${data.data.node.url}`);
                    return data.data.node.url;
                }
            }
            if (operationStatus === 'FAILED') {
                if (data.data?.node?.partialDataUrl !== null) {
                    console.log(`Partial results available at: ${data.data.node.partialDataUrl}`);
                    return data.data?.node?.partialDataUrl;
                } else {
                    console.log('No results available to download');
                    return null;
                }
            }
        } else {
            // Wait for a period before polling again
            console.log('Operation in progress. Waiting before next status check...');
            await new Promise(resolve => setTimeout(resolve, 30000));
        }
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

async function main() {
    const localRSRInventoryPath = './fulfillment-inv-new.txt';
    await downloadFileFTP('/ftpdownloads/fulfillment-inv-new.txt', localRSRInventoryPath); // rsr dropship inventory
    
    const bulkOperationId = await initiateProductFetchBulkOperation();
    const shopifyInventoryDownloadUrl = await pollBulkOperationStatus(bulkOperationId, graphqlEndpoint, headers);
    if (shopifyInventoryDownloadUrl) await downloadResults(shopifyInventoryDownloadUrl, './shopify_inventory.jsonl');
    
    transformAndCreateJSONL(localRSRInventoryPath);
    let stagedUploadPath = await uploadJSONLtoShopify('./new_products.jsonl').catch(console.error);
    const newProductsOperationId = await createBulkOperation(stagedUploadPath)
    const newProductsReturnUrl = await pollBulkOperationStatus(newProductsOperationId, graphqlEndpoint, headers);
    if (newProductsReturnUrl) await downloadResults(newProductsReturnUrl, './new_products_return.jsonl');
    const newProductIds = readLineJSONL('./new_products_return.jsonl', data => data.data?.productCreate?.product?.id);

    // TODO: new products publishablePublish

    // TODO:  updated products inventoryAdjustQuantity

    // TODO: variants?
}

// main().catch(console.error);
