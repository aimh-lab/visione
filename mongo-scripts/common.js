
/**
 * Common Mongo Pipelines for the VISIONE project.
 */
var MongoPipelines = {};

/** Pipelines for object.* collections */
MongoPipelines.objects = {};

/** Pipelines for features.* collections */
MongoPipelines.features = {};

/**
 * Transform detections in an object.* collection from the (object_class_names[], object_scores[], object_boxes_yxyx[]) format
 * to the {label, score, box_yxyx}[] format. Example:
 * 
 * INPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  object_class_names: [ 'kite', 'parasail_(sports)' ],
 *  object_scores: [ 0.61935407, 0.40562037 ],
 *  object_boxes_yxyx: [ [ 0.21, 0.12, 0.30, 0.18 ], [ 0.21, 0.12, 0.30, 0.17 ] ],
 * }
 * 
 * OUTPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [                                                                                                                                                                                                            
 *     {                                                                                                                                                                                                                   
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     },                                                                                                                                                                                                                  
 *     {                                                                                                                                                                                                                   
 *         label: 'parasail_(sports)',
 *         score: 0.40562037,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.17 ]
 *     }
 *   ]
 * }
 */
MongoPipelines.objects.parseCollection = (extraFields) => [
{
    $project: {
        // create a new field named 'objects' that's a list of objects, each with three fields ("label", "score", "box_yxyx"), from three parallel arrays.
        // Follow numbers for how it is built:
        objects: {
            $map: {
                input: { 
                    $map: {
                            // 1. zip() these three array fields into a list of triplets
                        input: { $zip: { inputs: ["$object_class_names", "$object_scores", "$object_boxes_yxyx"]}},
                        as: "objectAsArray",
                        in: {
                            $zip: {
                                // 2. zip() again each triplet with key names, creating a list of list of (key, value) couples
                                inputs: [
                                    { $literal: ["label", "score", "box_yxyx"] },
                                    "$$objectAsArray"
                                ]
                            }
                        }
                    },
                },
                as: "object",
                // 3. transform the list of (key, value) into an object
                in: { $arrayToObject: "$$object" }
            }
        },

        // add a {<field1>: true, ... <fieldN>: true} for each extraFields
        // FIXME: this line is a bit evil.
        ... Object.fromEntries((extraFields || []).map(f => [f, true]))
    }
}];

/**
 * Filter detections in an object.* collection in the {label, score, box_yxyx}[] format keeping only the ones
 * with scores greater or equal to minScore. Example:
 * 
 * INPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [
 *     {
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     },
 *     {
 *         label: 'parasail_(sports)',
 *         score: 0.40562037,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.17 ]
 *     }
 *   ]
 * }
 * 
 * MINSCORE: 0.5
 * 
 * OUTPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [
 *     {
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     }
 *   ]
 * }
 */
MongoPipelines.objects._filterByScore = (minScore) => [{
    $set: {
        objects: {
            $filter: {
                input: '$objects',
                as: 'object',
                cond: {$gte: ['$$object.score', minScore]}
            }
        }
    }
}];

/**
 * Transforms, filters, and merges detections from an objects.* collection to the frames collection.
 */
 MongoPipelines.objects._mergeFromCollection = (objCollectionName, threshold) => ([
    {$lookup: {
        from: objCollectionName,
        pipeline: [
            ... MongoPipelines.objects.parallelArraysToObjectList(),
            ... MongoPipelines.objects._filterByScore(threshold),
            {$unset: '_id'}
        ],
        localField: '_id',
        foreignField: '_id',
        as: objCollectionName
    }},
    {$set: {[objCollectionName]: {$first: `$${objCollectionName}.objects`}}}
]);

/**
 * Helper pipeline to get the field named `fieldName` from `inputObject` where both can be variables.
 * @param {stirng} fieldName Name of the field to get
 * @param {object} inputObject Object from which the field is taken.
 * @returns `inputObject[fieldName]` if fieldName exists, else does not return anything.
 */
MongoPipelines.objects.getField = (fieldName, inputObject) => ({
    $getField: {
        field: 'v',
        input : {
            $first: {
                $filter: {
                    input: {$objectToArray: inputObject},
                    as: "field",
                    cond: {$eq: ["$$field.k", fieldName]}
                }
            }
        }
    }
});

// TODO: rewrite this using $unwind and $group; it should be a lot more clean and readable
/**
 * Filter detections by score and minArea and map labels in an object.* collection in the {label, score, box_yxyx}[] format
 * as defined in the 'config' collection. Example:
 * 
 * INPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [
 *     {
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     },
 *     {
 *         label: 'parasail_(sports)',
 *         score: 0.40562037,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.17 ]
 *     }
 *   ]
 * }
 * 
 * CONFIG.OBJECTS.THRESHOLD[.<DETECTOR_NAME>]: 0.5
 * CONFIG.OBJECTS.MINAREA[.<DETECTOR_NAME>]: 0.001
 * CONFIG.OBJECTS.LABELMAP[.<DETECTOR_NAME>]: {"kite": "foo", "parasail_(sports)": "bar"}
 * CONFIG.OBJECTS.EXCLUDELABELS[.<DETECTOR_NAME>]: ["bar", "baz"]
 * 
 * OUTPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [
 *     {
 *         label: "foo",
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     }
 *   ]
 * }
 */
 MongoPipelines.objects.filterAndMap = (detectorName) => [
    // 1. load relevant values from the 'config' collection to a 'config' field
    {
        $lookup: {
            from: 'config',
            pipeline: [
                {$project: {_id: false, objects: true}},
                {$replaceRoot: {newRoot: '$objects'}},
                {$set:{
                    preExcludeLabels: {$ifNull: [`$excludeLabels.${detectorName}`, []]},  // labels to exclude per-detector before label mapping
                    postExcludeLabels: {$ifNull: ['$excludeLabels.all', []]},  // labels to exclude after label mapping
                    labelMap: {$ifNull: [`$labelMap.${detectorName}`, '$labelMap', {}]},
                    threshold: {$ifNull: [`$threshold.${detectorName}`, '$threshold', 0]},
                    minArea: {$ifNull: [`$minArea.${detectorName}`, '$minArea', 0]},
                }}
            ],
            as: 'config'
        }
    },
    {$set: {config: {$first: "$config"}}}, // there's only one document in 'config'
    // 2. filter by score
    {
        $set: {
            objects: {
                $filter: {
                    input: '$objects',
                    as: 'object',
                    cond: {$gte: ['$$object.score', '$config.threshold']}
                }
            }
        }
    },
    // 3. filter by normalized area
    {
        $set: {
            objects: {
                $filter: {
                    input: '$objects',
                    as: 'object',
                    cond: {
                        $gte: [
                            {$multiply: [ // compute the bbox area
                                {$subtract: [{$arrayElemAt: ['$$object.box_yxyx', 2]}, {$arrayElemAt: ['$$object.box_yxyx', 0]}]},
                                {$subtract: [{$arrayElemAt: ['$$object.box_yxyx', 3]}, {$arrayElemAt: ['$$object.box_yxyx', 1]}]}
                            ]},
                            '$config.minArea'
                        ]
                    }
                }
            }
        }
    },
    // 3½. filter by preExcludeLabels
    {
        $set: {
            objects: {
                $filter: {
                    input: '$objects',
                    as: 'object',
                    cond: {$not: [{$in: ['$$object.label', '$config.preExcludeLabels']}]}
                }
            }
        }
    },
    // 4. add original detector name and class labels (for debugging/inspection purposes)
    {
        $set: {
            objects: {
                $map: {
                    input: '$objects',
                    as: 'object',
                    in: {
                        $mergeObjects: [
                            '$$object',
                            {
                                detector: detectorName,
                                detector_label: '$$object.label',
                            }
                        ]
                    }
                }
            }
        }
    },
    // 5. uniform labels ... 
    {
        $set: {
            objects: {
                $map: {
                    input: '$objects',
                    as: 'object',
                    in: {
                        $setField: {
                            field: 'label',
                            input: '$$object',
                            value: { 
                                $replaceAll: {
                                    input: {$toLower: '$$object.label'},
                                    find: " ",
                                    replacement: "_"
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    // ... and apply label mapping
    {
        $set: {
            objects: {
                $map: {
                    input: '$objects',
                    as: 'object',
                    in: {
                        $setField: {
                            field: 'label',
                            input: '$$object',
                            value: {
                                $ifNull: [
                                    // $getField doesn't work with variable fieldnames... had to rewrite our own sub-pipeline
                                    MongoPipelines.objects.getField('$$object.label', '$config.labelMap'),
                                    // {$getField: {field: '$$object.label', input: '$config.labelMap'}},
                                    '$$object.label'
                                ]
                            }
                        }
                    }
                }
            }
        }
    },
    // 6. filter by postExcludeLabels
    {
        $set: {
            objects: {
                $filter: {
                    input: '$objects',
                    as: 'object',
                    cond: {$not: [{$in: ['$$object.label', '$config.postExcludeLabels']}]}
                }
            }
        }
    },
    // 7. drop config
    {$unset: 'config'}
];

/**
 * Transforms, filters, and merges detections from an objects.* collection to the frames collection,
 * following parameters in the 'config' collection.
 */
 MongoPipelines.objects.importFromCollection = (detectorName, extraFields) => ([
    {$lookup: {
        from: `objects.${detectorName}`,
        pipeline: [
            ... MongoPipelines.objects.parseCollection(extraFields),
            ... MongoPipelines.objects.filterAndMap(detectorName),
            {$unset: '_id'}
        ],
        localField: '_id',
        foreignField: '_id',
        as: detectorName
    }},
    {$set: {
        [detectorName]: {$first: `$${detectorName}.objects`},
        // FIXME: extraFields are added to the root object without checking name clashes between different detectors;
        // moreover, this line is pure evil right now.
        ... Object.fromEntries((extraFields || []).map(f => [f, {$first: `$${detectorName}.${f}`}]))
    }}

    
]);

/**
 * Merge arrays of detections separated by detector into a unique list of detections.
 * 
 * INPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  detecor_1: [
 *     {
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     },
 * ],
 * detector_2: [
 *     {
 *         label: 'parasail_(sports)',
 *         score: 0.40562037,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.17 ]
 *     }
 *   ]
 * }
 *  
 * OUTPUT DOCUMENT:
 * {
 *  _id: 'foo',
 *  objects: [
 *     {
 *         label: 'kite',
 *         score: 0.61935407,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.18 ]
 *     },
 *     {
 *         label: 'parasail_(sports)',
 *         score: 0.40562037,
 *         box_yxyx: [ 0.21, 0.12, 0.30, 0.17 ]
 *     }
 *   ]
 * }
 */
 MongoPipelines.objects.mergeDetections = (detectorNames) => ([
    // concatenate all detector array fields into a new 'objects' field
    {
        $set: {
            objects: {
                $concatArrays: detectorNames.map(x => ({$ifNull: [`$${x}`, []]}))
            }
        }
    },
    // delete merged fields
    ... detectorNames.map(x => ({$unset: x}))
 ]);

/**
 * Merge STR representations from a features.* collection to the frames collection.
 */
MongoPipelines.features.importFromCollection = (objCollectionName) => ([
    {$lookup: {
        from: objCollectionName,
        pipeline: [
            {$project: {feature: true}},
            {$unset: '_id'}
        ],
        localField: '_id',
        foreignField: '_id',
        as: objCollectionName
    }},
    {$set: {[objCollectionName]: {$first: `$${objCollectionName}.feature`}}}
]);

module.exports = MongoPipelines;