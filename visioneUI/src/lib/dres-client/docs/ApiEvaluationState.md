
# ApiEvaluationState


## Properties

Name | Type
------------ | -------------
`evaluationId` | string
`evaluationStatus` | [ApiEvaluationStatus](ApiEvaluationStatus.md)
`taskId` | string
`taskStatus` | [ApiTaskStatus](ApiTaskStatus.md)
`taskTemplateId` | string
`timeLeft` | number
`timeElapsed` | number

## Example

```typescript
import type { ApiEvaluationState } from ''

// TODO: Update the object below with actual values
const example = {
  "evaluationId": null,
  "evaluationStatus": null,
  "taskId": null,
  "taskStatus": null,
  "taskTemplateId": null,
  "timeLeft": null,
  "timeElapsed": null,
} satisfies ApiEvaluationState

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiEvaluationState
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


