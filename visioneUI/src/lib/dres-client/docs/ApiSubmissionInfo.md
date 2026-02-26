
# ApiSubmissionInfo


## Properties

Name | Type
------------ | -------------
`evaluationId` | string
`taskId` | string
`submissions` | [Array&lt;ApiSubmission&gt;](ApiSubmission.md)

## Example

```typescript
import type { ApiSubmissionInfo } from ''

// TODO: Update the object below with actual values
const example = {
  "evaluationId": null,
  "taskId": null,
  "submissions": null,
} satisfies ApiSubmissionInfo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiSubmissionInfo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


