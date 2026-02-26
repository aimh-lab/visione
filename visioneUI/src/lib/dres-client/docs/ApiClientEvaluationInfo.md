
# ApiClientEvaluationInfo


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`type` | [ApiEvaluationType](ApiEvaluationType.md)
`status` | [ApiEvaluationStatus](ApiEvaluationStatus.md)
`templateId` | string
`templateDescription` | string
`teams` | Array&lt;string&gt;
`taskTemplates` | [Array&lt;ApiClientTaskTemplateInfo&gt;](ApiClientTaskTemplateInfo.md)

## Example

```typescript
import type { ApiClientEvaluationInfo } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "type": null,
  "status": null,
  "templateId": null,
  "templateDescription": null,
  "teams": null,
  "taskTemplates": null,
} satisfies ApiClientEvaluationInfo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiClientEvaluationInfo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


