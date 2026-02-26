
# ApiMediaItem


## Properties

Name | Type
------------ | -------------
`mediaItemId` | string
`name` | string
`type` | [ApiMediaType](ApiMediaType.md)
`collectionId` | string
`location` | string
`durationMs` | number
`fps` | number
`metadata` | [Array&lt;ApiMediaItemMetaDataEntry&gt;](ApiMediaItemMetaDataEntry.md)

## Example

```typescript
import type { ApiMediaItem } from ''

// TODO: Update the object below with actual values
const example = {
  "mediaItemId": null,
  "name": null,
  "type": null,
  "collectionId": null,
  "location": null,
  "durationMs": null,
  "fps": null,
  "metadata": null,
} satisfies ApiMediaItem

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiMediaItem
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


