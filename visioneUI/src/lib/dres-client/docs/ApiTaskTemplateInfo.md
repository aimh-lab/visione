
# ApiTaskTemplateInfo


## Properties

Name | Type
------------ | -------------
`templateId` | string
`name` | string
`comment` | string
`taskGroup` | string
`taskType` | string
`duration` | number

## Example

```typescript
import type { ApiTaskTemplateInfo } from ''

// TODO: Update the object below with actual values
const example = {
  "templateId": null,
  "name": null,
  "comment": null,
  "taskGroup": null,
  "taskType": null,
  "duration": null,
} satisfies ApiTaskTemplateInfo

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTaskTemplateInfo
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


