
# ApiHintContent


## Properties

Name | Type
------------ | -------------
`taskId` | string
`sequence` | [Array&lt;ApiContentElement&gt;](ApiContentElement.md)
`loop` | boolean

## Example

```typescript
import type { ApiHintContent } from ''

// TODO: Update the object below with actual values
const example = {
  "taskId": null,
  "sequence": null,
  "loop": null,
} satisfies ApiHintContent

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiHintContent
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


