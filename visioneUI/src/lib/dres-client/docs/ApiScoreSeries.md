
# ApiScoreSeries


## Properties

Name | Type
------------ | -------------
`team` | string
`name` | string
`points` | [Array&lt;ApiScoreSeriesPoint&gt;](ApiScoreSeriesPoint.md)

## Example

```typescript
import type { ApiScoreSeries } from ''

// TODO: Update the object below with actual values
const example = {
  "team": null,
  "name": null,
  "points": null,
} satisfies ApiScoreSeries

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ApiScoreSeries
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


