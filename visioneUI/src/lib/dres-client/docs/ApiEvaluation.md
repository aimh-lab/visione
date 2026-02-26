
# ApiEvaluation


## Properties

Name | Type
------------ | -------------
`evaluationId` | string
`name` | string
`type` | [ApiEvaluationType](ApiEvaluationType.md)
`template` | [ApiEvaluationTemplate](ApiEvaluationTemplate.md)
`created` | number
`started` | number
`ended` | number
`tasks` | [Array&lt;ApiTask&gt;](ApiTask.md)

## Example

```typescript
import type { ApiEvaluation } from ''

// TODO: Update the object below with actual values
const example = {
  "evaluationId": null,
  "name": null,
  "type": null,
  "template": null,
  "created": null,
  "started": null,
  "ended": null,
  "tasks": null,
} satisfies ApiEvaluation

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiEvaluation
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


