
# ApiHint


## Properties

Name | Type
------------ | -------------
`type` | [ApiHintType](ApiHintType.md)
`start` | number
`end` | number
`description` | string
`path` | string
`dataType` | string
`item` | [ApiMediaItem](ApiMediaItem.md)
`range` | [ApiTemporalRange](ApiTemporalRange.md)

## Example

```typescript
import type { ApiHint } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "start": null,
  "end": null,
  "description": null,
  "path": null,
  "dataType": null,
  "item": null,
  "range": null,
} satisfies ApiHint

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiHint
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


