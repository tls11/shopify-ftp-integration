import 'dotenv/config'

import {
    downloadRSRftp,
    parseRSRInventory,
} from './rsr.js';
import { 
    downloadShopifyInventory,
    mapShopifyInventoryDetails,
    prepareFileCreateInfo,
    createFiles,
    productsToSet,
    productSet,
    readLineJSONL,
    getProductsInventoryDetails,
    updateQuantities,
} from './shopify.js';

async function main() {
    // fetch inventories
    await downloadRSRftp('/ftpdownloads/fulfillment-inv-new.txt', './rsr-inventory.txt');
    const rsrInventory = parseRSRInventory('./rsr-inventory.txt');
    rsrInventory.pop(); // remove empty line
    await downloadShopifyInventory();
    const shopifyInventoryMap = mapShopifyInventoryDetails();
    
    // create product image file assets
    // TODO: check if existing products have mediaIds
    const productsThatNeedMediaFiles = rsrInventory.filter(rsrItem => !shopifyInventoryMap.has(rsrItem['RSR Stock Number']));
    const fileCreateInfo = prepareFileCreateInfo(productsThatNeedMediaFiles);
    let mediaIds = await createFiles(fileCreateInfo, 200);
    mediaIds = mediaIds.map(item => ({ [item.alt]: item.id }));
    const altIds = Object.assign({}, ...mediaIds);
    
    // create/update shopify products
    // TODO: update any fields that rsr may have changed
    if (productsToSet()) {
        await productSet(rsrInventory, shopifyInventoryMap, altIds);
        const newProductIds = readLineJSONL('./productset-res-info.jsonl', resItem => resItem.data?.productSet?.product?.id );
        const newInventoryDetails = await getProductsInventoryDetails(newProductIds);
        newInventoryDetails.forEach(item => shopifyInventoryMap.set(item.sku, {
            quantity: item.inventoryQuantity,
            inventoryItemId: item.inventoryItem.id
        }));
    } 
    // update product inventory quantities
    await updateQuantities(rsrInventory, shopifyInventoryMap);

    // TODO: remove products no longer in rsr inventory
};

main().catch(console.error);
