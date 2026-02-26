
# ApiAnswer


## Properties

Name | Type
------------ | -------------
`type` | [ApiAnswerType](ApiAnswerType.md)
`item` | [ApiMediaItem](ApiMediaItem.md)
`text` | string
`start` | number
`end` | number
`temporalRange` | [TemporalRange](TemporalRange.md)

## Example

```typescript
import type { ApiAnswer } from ''

// TODO: Update the object below with actual values
const example = {
  "type": null,
  "item": null,
  "text": null,
  "start": null,
  "end": null,
  "temporalRange": null,
} satisfies ApiAnswer

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiAnswer
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


