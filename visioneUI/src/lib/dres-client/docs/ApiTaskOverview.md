
# ApiTaskOverview


## Properties

Name | Type
------------ | -------------
`id` | string
`name` | string
`type` | string
`group` | string
`duration` | number
`taskId` | string
`status` | [ApiTaskStatus](ApiTaskStatus.md)
`started` | number
`ended` | number

## Example

```typescript
import type { ApiTaskOverview } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "name": null,
  "type": null,
  "group": null,
  "duration": null,
  "taskId": null,
  "status": null,
  "started": null,
  "ended": null,
} satisfies ApiTaskOverview

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTaskOverview
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


