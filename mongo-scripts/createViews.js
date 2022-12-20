const MongoPipelines = require('./common.js');

dbNames = ['v3c', 'mvk']

extraFields = {
    colors: ['gray']
}

dbNames.forEach((dbName) => {
    // change db
    db = db.getSiblingDB(dbName);

    // 1. create objects.all view
    let viewName = 'view.objects.all'
    print(`Creating indexing view: ${dbName}.${viewName}`);

    detectorNames = db.getCollectionNames()
        .filter(c => c.startsWith('objects.'))
        .map(x => x.replace(/^objects\./, ''));
    
    detectorNames.sort()

    objectsImportPipeline = detectorNames.map(d => MongoPipelines.objects.importFromCollection(d, extraFields[d]));
    objectsMergePipeline = MongoPipelines.objects.mergeDetections(detectorNames);

    objectViewPipeline = [].concat(
        {$project: {'_id': true}}, // don't keep fields of the 'frames' collection but '_id'
        ...objectsImportPipeline,
        ...objectsMergePipeline
    );

    // create or replace view
    db.getCollection(viewName).drop()
    db.createView(viewName, 'frames', objectViewPipeline);
});
