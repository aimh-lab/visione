
# ApiTarget


## Properties

Name | Type
------------ | -------------
`type` | [ApiTargetType](ApiTargetType.md)
`target` | string
`range` | [ApiTemporalRange](ApiTemporalRange.md)
`item` | [ApiMediaItem](ApiMediaItem.md)

## Example

```typescript
import type { ApiTarget } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "target": null,
  "range": null,
  "item": null,
} satisfies ApiTarget

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiTarget
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


