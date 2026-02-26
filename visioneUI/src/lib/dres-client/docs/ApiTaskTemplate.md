
# ApiTaskTemplate


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`taskGroup` | string
`taskType` | string
`duration` | number
`collectionId` | string
`targets` | [Array&lt;ApiTarget&gt;](ApiTarget.md)
`hints` | [Array&lt;ApiHint&gt;](ApiHint.md)
`comment` | string

## Example

```typescript
import type { ApiTaskTemplate } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "taskGroup": null,
  "taskType": null,
  "duration": null,
  "collectionId": null,
  "targets": null,
  "hints": null,
  "comment": null,
} satisfies ApiTaskTemplate

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTaskTemplate
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


