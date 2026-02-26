
# ApiSubmission


## Properties

Name | Type
------------ | -------------
`submissionId` | string
`teamId` | string
`memberId` | string
`teamName` | string
`memberName` | string
`timestamp` | number
`answers` | [Array&lt;ApiAnswerSet&gt;](ApiAnswerSet.md)

## Example

```typescript
import type { ApiSubmission } from ''

// TODO: Update the object below with actual values
const example = {
  "submissionId": null,
  "teamId": null,
  "memberId": null,
  "teamName": null,
  "memberName": null,
  "timestamp": null,
  "answers": null,
} satisfies ApiSubmission

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiSubmission
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


