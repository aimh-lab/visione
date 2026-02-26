
# ApiClientAnswerSet


## Properties

Name | Type
------------ | -------------
`taskId` | string
`taskName` | string
`answers` | [Array&lt;ApiClientAnswer&gt;](ApiClientAnswer.md)

## Example

```typescript
import type { ApiClientAnswerSet } from ''

// TODO: Update the object below with actual values
const example = {
  "taskId": null,
  "taskName": null,
  "answers": null,
} satisfies ApiClientAnswerSet

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiClientAnswerSet
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


