
# ApiJudgementRequest


## Properties

Name | Type
------------ | -------------
`token` | string
`validator` | string
`taskDescription` | string
`answerSet` | [ApiAnswerSet](ApiAnswerSet.md)

## Example

```typescript
import type { ApiJudgementRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "token": null,
  "validator": null,
  "taskDescription": null,
  "answerSet": null,
} satisfies ApiJudgementRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiJudgementRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


