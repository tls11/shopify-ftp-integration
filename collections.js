// collections.js
import { config } from 'dotenv';
import axios from 'axios';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import fs from 'fs';
config();

const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
const SHOPIFY_API_SECRET_KEY = process.env.SHOPIFY_API_SECRET_KEY;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const graphqlEndpoint = `https://${SHOPIFY_DOMAIN}/admin/api/${LATEST_API_VERSION}/graphql.json`;

const headers = {
    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
    'Content-Type': 'application/json',
};

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
        { title: "Upper Receivers & Conversion Kits - High Capacity", handle: "upper-receivers-conversion-kits-high-capacity" }
    ];
    const collectionsData = [];

    for (let { title, handle } of collections) {
        let collection = await fetchCollectionByHandle(handle);
        if (!collection) {
            console.log(`Collection with handle "${handle}" does not exist. Skipping.`);
            continue;
        }
        collectionsData.push({
            handle: collection.handle,
            title: collection.title,
            gid: collection.id
        });
    }

    fs.writeFileSync('collections.json', JSON.stringify(collectionsData, null, 2));
    console.log('Collections data has been written to collections.json');
}

createOrFetchCollections().catch(console.error);