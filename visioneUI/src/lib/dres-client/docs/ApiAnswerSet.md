
# ApiAnswerSet


## Properties

Name | Type
------------ | -------------
`id` | string
`status` | [ApiVerdictStatus](ApiVerdictStatus.md)
`taskId` | string
`answers` | [Array&lt;ApiAnswer&gt;](ApiAnswer.md)

## Example

```typescript
import type { ApiAnswerSet } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "status": null,
  "taskId": null,
  "answers": null,
} satisfies ApiAnswerSet

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiAnswerSet
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


