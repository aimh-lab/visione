
# QueryResultLog


## Properties

Name | Type
------------ | -------------
`timestamp` | number
`sortType` | string
`resultSetAvailability` | string
`results` | [Array&lt;RankedAnswer&gt;](RankedAnswer.md)
`events` | [Array&lt;QueryEvent&gt;](QueryEvent.md)

## Example

```typescript
import type { QueryResultLog } from ''

// TODO: Update the object below with actual values
const example = {
  "timestamp": null,
  "sortType": null,
  "resultSetAvailability": null,
  "results": null,
  "events": null,
} satisfies QueryResultLog

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as QueryResultLog
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


