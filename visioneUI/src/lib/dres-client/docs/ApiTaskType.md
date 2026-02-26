
# ApiTaskType


## Properties

Name | Type
------------ | -------------
`name` | string
`duration` | number
`targetOption` | [ApiTargetOption](ApiTargetOption.md)
`hintOptions` | [Array&lt;ApiHintOption&gt;](ApiHintOption.md)
`submissionOptions` | [Array&lt;ApiSubmissionOption&gt;](ApiSubmissionOption.md)
`taskOptions` | [Array&lt;ApiTaskOption&gt;](ApiTaskOption.md)
`scoreOption` | [ApiScoreOption](ApiScoreOption.md)
`_configuration` | { [key: string]: string; }

## Example

```typescript
import type { ApiTaskType } from ''

// TODO: Update the object below with actual values
const example = {
  "name": null,
  "duration": null,
  "targetOption": null,
  "hintOptions": null,
  "submissionOptions": null,
  "taskOptions": null,
  "scoreOption": null,
  "_configuration": null,
} satisfies ApiTaskType

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTaskType
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


