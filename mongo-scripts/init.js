/**
 * Mongo initialization script for a VISIONE instance/collection.
 */

// 'collection' is the default database name
db = db.getSiblingDB('collection');

// create empty tables/collections
db.createCollection('config');
db.createCollection('videos');
db.createCollection('frames');

// add default configuration to the 'config' collection
let configDoc = require('./defaulfConfig.json');
db.getCollection('config').insertOne(configDoc);