import 'dotenv/config';
import fs from 'fs';
import { Stream } from 'stream';
import { promisify } from 'util';

import axios from 'axios';
import FormData from 'form-data';
import { DEPARTMENT_NUMBER_GID_MAP } from './rsr.js';

const pipeline = promisify(Stream.pipeline);

const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_STORE_NAME = process.env.SHOPIFY_STORE_NAME;
const SHOPIFY_LOCATION_ID = process.env.SHOPIFY_LOCATION_ID

const graphqlEndpoint = `https://${SHOPIFY_STORE_NAME}.myshopify.com/admin/api/2024-07/graphql.json`;
const headers = {
  'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
  'Content-Type': 'application/json',
};

async function initiateProductFetchBulkOperation() {
  const query = `
      {
          products {
              edges {
                  node {
                      id
                      totalInventory
                      media {
                        edges {
                          node {
                            id
                          }
                        }
                      }
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
    const response = await axios.post(
      graphqlEndpoint,
      JSON.stringify({ query: bulkOperationQuery }),
      { headers }
    );
    const bulkOperation = response.data.data.bulkOperationRunQuery.bulkOperation;
    console.log(`Bulk operation initiated with ID: ${bulkOperation.id}, status: ${bulkOperation.status}`);
    return bulkOperation.id;
  } catch (error) {
    console.error('Failed to initiate bulk fetch operation:', error.message);
  }
}

async function pollBulkOperationStatus(operationId) {
  let operationInProgress = true;
  console.log(`Polling status of operation: ${operationId}`);

  while (operationInProgress) {
    const { data } = await axios.post(
      graphqlEndpoint,
      {
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
      },
      { headers }
    );

    const operationStatus = data.data.node.status;
    const objectCount = data.data.node.objectCount;
    console.log(`Current operation status: ${operationStatus}`);
    console.log(`operations completed: ${objectCount}`);

    if (operationStatus === 'COMPLETED' || operationStatus === 'FAILED') {
      operationInProgress = false;
      console.log(`Operation finished with status: ${operationStatus}`);

      if (operationStatus === 'COMPLETED') {
        if (data.data.node.url) {
          console.log(`Results available at: ${data.data.node.url}`);
          return data.data.node.url;
        }
      }
      if (operationStatus === 'FAILED') {
        if (data.data.node.partialDataUrl !== null) {
          console.log(`Partial results available at: ${data.data.node.partialDataUrl}`);
          return data.data.node.partialDataUrl;
        } else {
          console.log('No results available to download');
          throw new Error('polling failed');
        }
      }
    } else {
      // Wait for a period before polling again
      console.log('Operation in progress. Waiting before next status check...');
      await new Promise((resolve) => setTimeout(resolve, 30000));
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

export function readLineJSONL(filePath, cb) {
  const collection = [];
  if (fs.existsSync(filePath)) {
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      for (let line of lines) {
          if (line) {
              const data = JSON.parse(line);
              if (cb) collection.push(cb(data));
              else collection.push(data);
          }
      }
  }
  return collection;
}

export async function downloadShopifyInventory() {
  const bulkOperationId = await initiateProductFetchBulkOperation();
  const downloadUrl = await pollBulkOperationStatus(bulkOperationId);
  if (downloadUrl) await downloadResults(downloadUrl, './shopify-inventory.jsonl');
}

export function mapShopifyInventoryDetails() {
  const shopifyInventoryPath = './shopify-inventory.jsonl';
  const inventoryDetails = new Map(); // Map SKU to detailed inventory info
  if (fs.existsSync(shopifyInventoryPath)) {
      const inventoryData = fs.readFileSync(shopifyInventoryPath, 'utf8').split('\n');
      for (let line of inventoryData) {
          if (line) {
              const data = JSON.parse(line);
              if (data.sku && data.inventoryQuantity !== undefined) {
                  inventoryDetails.set(data.sku, {
                      quantity: data.inventoryQuantity,
                      productId: data.__parentId, // product - parent of variant
                      inventoryItemId: data.inventoryItem.id
                  });
              }
          }
      }
  }
  return inventoryDetails;
}

export function prepareFileCreateInfo(items) {
  return items.map(item => ({
    alt: item['Product Description'],
    contentType: 'IMAGE',
    originalSource: 'https://img.rsrgroup.com/pimages/' + item['Image Name'],
  }));
}

async function createFile(fileInfo) {
  const mutation = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
      }
    }
  }`

  const variables = {
    files: fileInfo
  };

  try {
    const { data } = await axios.post(
      graphqlEndpoint,
      { query: mutation, variables },
      { headers }
    );
    if (data.data.fileCreate.files.length) {
      console.log(`${data.data.fileCreate.files.length} files created successfully.`);
      return data.data.fileCreate.files;
    } else if (!data.data.fileCreate.files.length) {
      console.error('Failed to create files:', data.data.fileCreate.userErrors);
      return null;
    }
  } catch (error) {
    console.error(`Failed to create files:`, error);
    throw error;
  }
}

export async function createFiles(arr, size) {
  const mediaIds = [];
  for (let i = 0; i < arr.length; i += size) {
    const chunk = arr.slice(i, i + size);
    const res = await createFile(chunk);
    mediaIds.push(...res);
    await new Promise((resolve) => setTimeout(resolve, 2000));
  };
  return mediaIds;
}

function prepareProductSetInput(product, shopifyInventoryMap, altIds) {
  const sku = product['RSR Stock Number'];
  const productId = shopifyInventoryMap.get(sku)?.productId;
  const collectionGID = DEPARTMENT_NUMBER_GID_MAP[product['Department Number']];
  return { 
      input: {
      ...(productId ? { id: productId } : {}), 
      collections: [collectionGID],
      descriptionHtml: product['Expanded Product Description'],
      mediaIds: [altIds[product['Product Description']]],
      status: 'ACTIVE',
      title: product['Product Description'],
      productOptions: [{ name: 'n/a', position: 1, values: [{ name: 'n/a' }] }],
      variants: [
        {
          optionValues: [{ optionName: 'n/a', name: 'n/a' }],
          price: product['Retail Price'],
          sku,
        }
      ]
    }
  }
}

async function createProductSetJSONL(rsrProducts, shopifyInventoryMap, altIds) {
  const productSetInputs = [];
  for (let product of rsrProducts) {
    const sku = product['RSR Stock Number'];
    if (!shopifyInventoryMap.has(sku)) {
      const productSetInput = prepareProductSetInput(product, shopifyInventoryMap, altIds);
      productSetInputs.push(productSetInput);
    }
  }
  if (productSetInputs.length) {
    const productSetJsonlContent = productSetInputs.map(p => JSON.stringify(p)).join('\n');
    fs.writeFileSync('./productset-inputs.jsonl', productSetJsonlContent);
    console.log(`${productSetInputs.length} products to be set.`);
  }
}

export function productsToSet() {
  return fs.existsSync('./productset-inputs.jsonl');
}

async function stageUpload() {
  // Prepare the mutation for creating staged upload
  const mutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
              stagedTargets {
                  url
                  resourceUrl
                  parameters {
                      name
                      value
                  }
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

      const stagedTarget = data.data.stagedUploadsCreate.stagedTargets[0];
      return stagedTarget;
  } catch (error) {
      console.error('Failed to stage upload:', error.message);
  }
}

async function uploadJSONLtoShopify(stagedTarget, jsonlFilePath) {
  try {
      const uploadUrl = stagedTarget.url;
      const params = stagedTarget.parameters.reduce((acc, { name, value }) => ({ ...acc, [name]: value }), {});
      const resourceUrl = stagedTarget.resourceUrl;
      const formData = new FormData();
      Object.keys(params).forEach(key => formData.append(key, params[key]));
      formData.append('file', fs.createReadStream(jsonlFilePath), 'products.jsonl');

      await axios.post(uploadUrl, formData, {
          headers: formData.getHeaders(),
      });

      console.log('File uploaded successfully.');
      return params['key']; // Using the 'key' parameter as stagedUploadPath
  } catch (error) {
      console.error('Failed to upload JSONL to Shopify:', error.message);
  }
}

async function initiateProductSetBulkOperation(stagedUploadPath) {
  const bulkOperationMutation = `
    mutation {
      bulkOperationRunMutation(
        mutation: """
          mutation setProducts($input: ProductSetInput!) {
            productSet(synchronous: true, input: $input) {
              product {
                id
              }
              productSetOperation {
                id
                status
                userErrors {
                  code
                  field
                  message
                }
              }
              userErrors {
                code
                field
                message
              }
            }
          }
        """,
        stagedUploadPath: "${stagedUploadPath}"
      ) {
        bulkOperation {
          id
          url
          status
        }
        userErrors {
          message
          field
        }
      }
    }
  `;

  const bulkOperationResponse = await axios.post(graphqlEndpoint, {
    query: bulkOperationMutation,
  }, { headers });

  console.log('Bulk operation initiated:', JSON.stringify(bulkOperationResponse.data));

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

export async function productSet(rsrInventory, shopifyInventoryMap, altIds) {
    createProductSetJSONL(rsrInventory, shopifyInventoryMap, altIds);
    const stagedTarget = await stageUpload();
    const stagedUploadPath = await uploadJSONLtoShopify(stagedTarget, './productset-inputs.jsonl');
    const bulkOperationId = await initiateProductSetBulkOperation(stagedUploadPath);
    const downloadUrl = await pollBulkOperationStatus(bulkOperationId);
    if (downloadUrl) await downloadResults(downloadUrl, './productset-res-info.jsonl');
}

export async function getProductInventoryDetails(productId) {
  const query = `
  query GetProductVariants {
    product(id: "${productId}"
  ) {
      variants(first: 5) {
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
  }`

  try {
    const { data } = await axios.post(
      graphqlEndpoint,
      { query: query },
      { headers }
    );
    return data.data.product.variants.edges[0].node;
  } catch (error) {
    console.error(`Failed to get inventory details:`, error);
    throw error;
  }
}

export async function getProductsInventoryDetails(productIds) {
  const inventoryDetails = [];
  for (const productId of productIds) {
    const deets = await getProductInventoryDetails(productId);
    if (deets) inventoryDetails.push(deets);
  }
  return inventoryDetails;
}

export function prepareInventoryInfo(rsrInventory, shopifyInventoryMap) {
  const inventoryInfo = [];
  for (let rsrItem of rsrInventory) {
      const shopifyItem = shopifyInventoryMap.get(rsrItem['RSR Stock Number']);
      if (!shopifyItem) continue;
      if (shopifyItem.quantity != rsrItem['Inventory Quantity']) {
        inventoryInfo.push({
              inventoryItemId: shopifyItem.inventoryItemId,
              locationId: 'gid://shopify/Location/' + SHOPIFY_LOCATION_ID,
              quantity: +rsrItem['Inventory Quantity']
          });
      }
  }
  return inventoryInfo;
}

async function inventorySetQuantities(inventoryInfo) {
  const mutation = `mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
    inventorySetQuantities(input: $input) {
      inventoryAdjustmentGroup {
        reason
        referenceDocumentUri
        changes {
          name
          delta
          quantityAfterChange
        }
      }
      userErrors {
        code
        field
        message
      }
    }
  }`

  const variables = {
    input: {
      ignoreCompareQuantity: true,
      name: 'available',
      reason: 'cycle_count_available',
      quantities: inventoryInfo,
    }
  }

  try {
    const { data } = await axios.post(
      graphqlEndpoint,
      { query: mutation, variables },
      { headers }
    );
    console.log(`product batch of ${inventoryInfo.length} had quantities successfully set`);
  } catch (error) {
    console.error('Failed to set quantity:', error);
    throw error;
  }
}

async function inventorySetQuantitiesBatch(arr, size) {
    console.log(`inventorySetQuantitiesBatch: processing ${arr.length} products`);
    for (let i = 0; i < arr.length; i += size) {
      const chunk = arr.slice(i, i + size);
      await inventorySetQuantities(chunk);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    };
}

export async function updateQuantities(rsrInventory, shopifyInventoryMap) {
  const inventortyInfo = prepareInventoryInfo(rsrInventory, shopifyInventoryMap);
  await inventorySetQuantitiesBatch(inventortyInfo, 150);
}
