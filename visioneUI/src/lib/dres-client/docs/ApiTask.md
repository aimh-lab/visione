
# ApiTask


## Properties

Name | Type
------------ | -------------
`taskId` | string
`templateId` | string
`started` | number
`ended` | number
`submissions` | [Array&lt;ApiSubmission&gt;](ApiSubmission.md)

## Example

```typescript
import type { ApiTask } from ''

// TODO: Update the object below with actual values
const example = {
  "taskId": null,
  "templateId": null,
  "started": null,
  "ended": null,
  "submissions": null,
} satisfies ApiTask

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTask
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


